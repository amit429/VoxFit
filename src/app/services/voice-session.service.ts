import { Injectable, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { CapacitorAudioRecorder } from '@capgo/capacitor-audio-recorder';
import { SupabaseService } from '@/app/services/supabase.service';

/**
 * What the session is doing right now, so the UI can label the wait honestly
 * instead of showing one opaque spinner across two very different operations.
 */
export type VoiceSessionPhase = 'idle' | 'recording' | 'uploading' | 'transcribing';

/**
 * Hard cap on a single recording. Nobody narrates a workout for three minutes,
 * and the cap bounds the upload (~1–2 MB of AAC/Opus) far below both our own
 * 12 MB guard and Groq's 25 MB limit — so a phone left recording in a pocket
 * costs one wasted request, not a failed one.
 */
const MAX_RECORDING_MS = 3 * 60 * 1000;

/**
 * How often we ask the recorder for the current input level. The plugin's own
 * guidance is 60–100 ms for a waveform; each call crosses the JS/native bridge,
 * so this sits at the cheap end of that range.
 */
const AMPLITUDE_POLL_MS = 100;

/**
 * Floor for the adaptive loudness ceiling (see `sampleAmplitude`). The plugin
 * reports a different quantity per platform — Android the peak sample since the
 * last call, iOS average power in dB converted to linear, Web the RMS of the
 * latest frame — so there is no fixed scale to divide by. This is the quietest
 * signal we will still treat as "full", which keeps silence reading as silence
 * instead of the normaliser amplifying room noise to full height.
 */
const MIN_AMPLITUDE_CEILING = 0.02;

/** Recorder output → filename extension. Whisper detects format from the name. */
const EXTENSION_BY_TYPE: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

/** Strips codec parameters (`audio/webm;codecs=opus`) before the table lookup. */
function extensionFor(mimeType: string, fallback: string): string {
  const base = mimeType.split(';')[0].trim().toLowerCase();
  return EXTENSION_BY_TYPE[base] ?? fallback;
}

/** Bounds how long a native bridge call or upload may hang before we give up. */
function promiseWithTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });
  return Promise.race([promise, deadline]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }) as Promise<T>;
}

/**
 * Records a bounded voice clip and transcribes it in one request.
 *
 * This deliberately replaced live speech recognition (Web Speech API on the web,
 * `@capacitor-community/speech-recognition` on Android). Both are *session*
 * based: the recogniser ends itself after a second or two of silence and has to
 * be restarted, every restart can fail — Android's `SpeechRecognizer` routinely
 * answers `ERROR_RECOGNIZER_BUSY` when restarted from inside its own stop
 * callback — and a failed restart left the app capturing nothing while the orb
 * still said "listening". Roughly 300 lines of restart bookkeeping, boundary
 * de-duplication and cross-session transcript stitching existed to paper over
 * that, and it still dropped the audio spoken during each restart gap.
 *
 * A recording has no session to time out, so none of that is needed. The trade
 * is that there is no live transcript — which costs nothing here, because the
 * old one was never rendered in any template.
 */
@Injectable({ providedIn: 'root' })
export class VoiceSessionService {
  private readonly supabase = inject(SupabaseService);

  /** Drives the listening/processing copy on the voice pages. */
  readonly phase = signal<VoiceSessionPhase>('idle');

  /**
   * Flips true when `MAX_RECORDING_MS` elapses and we halt the recorder
   * ourselves. The pages watch this to submit what was captured, rather than
   * leaving the user talking into a recorder that has already stopped.
   */
  readonly limitReached = signal(false);

  /**
   * Live microphone level, 0–1, while recording. This is the app's only honest
   * "we can hear you" signal: the recogniser this replaced exposed a live
   * transcript that was never rendered, so the orb animated identically whether
   * the mic was working or dead. A meter driven by the real input cannot lie
   * that way.
   */
  readonly amplitude = signal(0);

  /**
   * Set when the cap halted the recorder, so the pending `stop()` uploads that
   * audio instead of asking a stopped recorder for a second result.
   */
  private cappedClip: Blob | null = null;
  private limitTimer: ReturnType<typeof setTimeout> | undefined;
  private amplitudeTimer: ReturnType<typeof setInterval> | undefined;
  /** Loudest level seen recently, used to normalise the platform-specific scale. */
  private amplitudeCeiling = MIN_AMPLITUDE_CEILING;

  async start(): Promise<void> {
    await this.cancel();

    let status = await CapacitorAudioRecorder.checkPermissions();
    if (status.recordAudio !== 'granted') {
      status = await CapacitorAudioRecorder.requestPermissions();
    }
    if (status.recordAudio !== 'granted') {
      throw new Error('Microphone permission is needed to log by voice.');
    }

    await CapacitorAudioRecorder.startRecording();
    this.phase.set('recording');
    this.limitTimer = setTimeout(() => {
      void this.haltAtLimit();
    }, MAX_RECORDING_MS);
    this.startAmplitudePolling();
  }

  /**
   * Stops recording and returns the transcript. The network round-trip lives
   * inside this call on purpose: both pages already show a processing state
   * between stop and the Gemini result, so the transcript arrives inside a wait
   * the user is in anyway.
   */
  async stop(): Promise<string> {
    this.clearLimitTimer();
    this.stopAmplitudePolling();
    try {
      const clip = this.cappedClip ?? (await this.finishRecording());
      this.cappedClip = null;
      if (!clip || clip.size === 0) {
        throw new Error('No audio was recorded — check the microphone and try again.');
      }
      this.phase.set('uploading');
      return await this.transcribe(clip);
    } finally {
      this.phase.set('idle');
      this.limitReached.set(false);
    }
  }

  /**
   * Ends any in-flight recording and discards the audio (navigating away,
   * cancelling). Safe to call when nothing is recording — both pages call it
   * from several lifecycle hooks.
   */
  async cancel(): Promise<void> {
    this.clearLimitTimer();
    this.stopAmplitudePolling();
    this.cappedClip = null;
    this.limitReached.set(false);
    this.phase.set('idle');
    try {
      const { status } = await CapacitorAudioRecorder.getRecordingStatus();
      if (status === 'INACTIVE') return;
      await CapacitorAudioRecorder.cancelRecording();
    } catch (err) {
      // Nothing to salvage on a discard path; a recorder we cannot reach is
      // already in the state we wanted it in.
      console.warn('[VoiceSession] Cancel failed:', err);
    }
  }

  /** Stops the recorder and resolves its output to a Blob on either platform. */
  private async finishRecording(): Promise<Blob | null> {
    const result = await promiseWithTimeout(
      CapacitorAudioRecorder.stopRecording(),
      15_000,
      'The recorder did not finish. Try again.',
    );

    // Web hands back a Blob directly; Android returns a `file://` URI into the
    // app's cache directory. `convertFileSrc` maps that onto the Capacitor local
    // server, which is the only way the WebView can read it.
    if (result.blob) return result.blob;
    if (!result.uri) return null;
    const response = await fetch(Capacitor.convertFileSrc(result.uri));
    if (!response.ok) {
      throw new Error('Could not read the recording from the device.');
    }
    return await response.blob();
  }

  private async transcribe(clip: Blob): Promise<string> {
    // Android records AAC in MPEG-4 (`.m4a`), the web MediaRecorder Opus in
    // WebM. Whisper infers the container from this filename, so a wrong
    // extension fails upstream rather than degrading.
    const filename = `voice-log.${extensionFor(clip.type, Capacitor.isNativePlatform() ? 'm4a' : 'webm')}`;
    const form = new FormData();
    form.append('file', clip, filename);

    this.phase.set('transcribing');
    const { data, error } = await this.supabase.client.functions.invoke('transcribe-audio', {
      body: form,
    });

    if (error) {
      // Non-2xx responses arrive as an error with the body on `context`. The
      // function's own message ("No speech detected") is the useful one — the
      // generic FunctionsHttpError text is not.
      throw new Error(await readEdgeFunctionError(error, 'Could not transcribe that recording.'));
    }

    const transcript = String((data as { transcript?: unknown } | null)?.transcript ?? '').trim();
    if (!transcript) {
      throw new Error('No speech detected — try again.');
    }
    return transcript;
  }

  /**
   * The cap fired. Stop the recorder but keep the audio: the user has been
   * talking, and throwing away three minutes of it to enforce a limit they
   * never saw would be worse than the limit itself.
   */
  private async haltAtLimit(): Promise<void> {
    this.limitTimer = undefined;
    this.stopAmplitudePolling();
    try {
      this.cappedClip = await this.finishRecording();
    } catch (err) {
      console.warn('[VoiceSession] Halting at the recording limit failed:', err);
    } finally {
      this.limitReached.set(true);
    }
  }

  private clearLimitTimer(): void {
    if (this.limitTimer !== undefined) {
      clearTimeout(this.limitTimer);
      this.limitTimer = undefined;
    }
  }

  private startAmplitudePolling(): void {
    this.amplitudeCeiling = MIN_AMPLITUDE_CEILING;
    this.amplitude.set(0);
    this.amplitudeTimer = setInterval(() => {
      void this.sampleAmplitude();
    }, AMPLITUDE_POLL_MS);
  }

  private stopAmplitudePolling(): void {
    if (this.amplitudeTimer !== undefined) {
      clearInterval(this.amplitudeTimer);
      this.amplitudeTimer = undefined;
    }
    this.amplitude.set(0);
  }

  /**
   * Normalises one reading onto 0–1. The raw value has no fixed scale (it means
   * something different on each platform, and quiet speech on a phone mic can
   * sit an order of magnitude below a laptop's), so instead of a per-platform
   * calibration curve we can't measure, the meter divides by the loudest level
   * seen recently. That ceiling decays, so one door slam doesn't flatten the
   * meter for the rest of the recording, and it never drops below a floor, so
   * silence stays silent rather than being amplified into a full bar.
   */
  private async sampleAmplitude(): Promise<void> {
    let value: number;
    try {
      ({ value } = await CapacitorAudioRecorder.getCurrentAmplitude());
    } catch {
      // Metering is decoration on top of recording — if it is unavailable, drop
      // the meter rather than the session.
      this.stopAmplitudePolling();
      return;
    }
    if (!Number.isFinite(value) || value < 0) return;

    this.amplitudeCeiling = Math.max(value, this.amplitudeCeiling * 0.97, MIN_AMPLITUDE_CEILING);
    const normalized = Math.min(value / this.amplitudeCeiling, 1);
    // Ease toward the new reading so a 10 Hz poll reads as a moving level
    // rather than a strobe.
    this.amplitude.update((prev) => prev + (normalized - prev) * 0.45);
  }
}

/** Pulls the `{ error }` message out of a Supabase Functions error response. */
async function readEdgeFunctionError(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: unknown }).context;
  if (context instanceof Response) {
    try {
      const body = (await context.json()) as { error?: unknown };
      const message = String(body.error ?? '').trim();
      if (message) return message;
    } catch {
      /* body was not JSON — fall through */
    }
  }
  console.error('[VoiceSession] Transcription failed', error);
  return fallback;
}
