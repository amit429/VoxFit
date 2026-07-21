import { Injectable, signal } from '@angular/core';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

/** Minimal typings for Web Speech API (prefix variants differ by browser). */
interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionEvent) => void) | null;
  onerror: ((this: SpeechRecognitionInstance, ev: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((this: SpeechRecognitionInstance, ev: Event) => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getWebSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.webkitSpeechRecognition ?? w.SpeechRecognition ?? null;
}

/** Bounds how long native bridge calls may hang (see Android SpeechRecognition.stop() plugin bug fix in node_modules or patch-package). */
function promiseWithTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), ms);
  });
  return Promise.race([promise, deadline]).finally(() => {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }) as Promise<T>;
}

@Injectable({ providedIn: 'root' })
export class VoiceSessionService {
  /** Live text while listening (partials on native, interim + finals on web). */
  readonly transcriptPreview = signal('');

  private partialListener?: PluginListenerHandle;
  private nativeListening = false;
  private webRecognition?: SpeechRecognitionInstance;
  private webFinalBuffer = '';
  /**
   * Tracks the highest result index already committed to webFinalBuffer.
   * Mobile Chrome fires resultIndex=0 on every event, which causes duplicate
   * finals — this guard prevents re-processing already-handled entries.
   */
  private webLastFinalIndex = 0;
  /**
   * True while we deliberately want recognition running.
   * Used to auto-restart after mobile browsers silently stop continuous mode.
   */
  private webActive = false;

  /**
   * Ends any in-flight session without returning text (e.g. navigate away).
   */
  async cancel(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      await this.cleanupNativeSession();
      return;
    }
    this.abortWebSession();
  }

  async start(): Promise<void> {
    await this.cancel();
    this.transcriptPreview.set('');
    this.webFinalBuffer = '';
    this.webLastFinalIndex = 0;

    if (Capacitor.isNativePlatform()) {
      await this.startNative();
      return;
    }
    this.startWeb();
  }

  /**
   * Stops listening and returns the best-effort final transcript.
   */
  async stop(): Promise<string> {
    if (Capacitor.isNativePlatform()) {
      return this.stopNative();
    }
    return this.stopWeb();
  }

  private async startNative(): Promise<void> {
    const status = await SpeechRecognition.requestPermissions();
    if (status.speechRecognition !== 'granted') {
      throw new Error('Speech recognition permission was not granted.');
    }
    const { available } = await SpeechRecognition.available();
    if (!available) {
      throw new Error('Speech recognition is not available on this device.');
    }

    await SpeechRecognition.removeAllListeners();
    this.partialListener = await SpeechRecognition.addListener('partialResults', (data) => {
      const text = data.matches?.[0]?.trim() ?? '';
      if (text.length > 0) {
        this.transcriptPreview.set(text);
      }
    });

    await SpeechRecognition.start({
      language: 'en-US',
      maxResults: 5,
      partialResults: true,
      popup: false,
    });
    this.nativeListening = true;
  }

  private async stopNative(): Promise<string> {
    let stopError: unknown;
    try {
      if (this.nativeListening) {
        await promiseWithTimeout(
          SpeechRecognition.stop(),
          12_000,
          'Stopping speech recognition timed out (native plug-in did not complete).',
        );
      }
    } catch (err) {
      stopError = err;
      console.warn('[VoiceSession] Native stop failed:', err);
    } finally {
      await this.cleanupNativeSession();
    }
    const text = this.transcriptPreview().trim();
    if (stopError !== undefined && text.length === 0) {
      if (stopError instanceof Error) {
        throw stopError;
      }
      throw new Error(String(stopError));
    }
    return text;
  }

  private async cleanupNativeSession(): Promise<void> {
    try {
      await this.partialListener?.remove();
    } catch {
      /* noop */
    }
    this.partialListener = undefined;
    try {
      await SpeechRecognition.removeAllListeners();
    } catch {
      /* noop */
    }
    this.nativeListening = false;
  }

  private startWeb(): void {
    const Ctor = getWebSpeechRecognitionCtor();
    if (!Ctor) {
      throw new Error('This browser does not support the Web Speech API. Try Chrome or the native app.');
    }
    this.webActive = true;
    this.startWebRecognitionInstance(Ctor);
  }

  /**
   * Creates and starts one recognition instance. Mobile Chrome silently ends
   * "continuous" recognition after a couple seconds of silence, so `onend`
   * below restarts by calling this again — spinning up a genuinely *fresh*
   * instance rather than restarting the ended one. The ended instance's result
   * indices don't carry over cleanly to the new session (this was previously a
   * source of dropped/duplicated chunks), so each fresh instance gets its own
   * zeroed `webLastFinalIndex` while `webFinalBuffer` (the accumulated text
   * across the whole recording) is left untouched.
   */
  private startWebRecognitionInstance(Ctor: SpeechRecognitionConstructor): void {
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    this.webLastFinalIndex = 0;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      // Mobile Chrome bug: resultIndex is sometimes 0 even for subsequent events,
      // so we take the higher of the two to avoid re-processing already-final chunks.
      const startFrom = Math.max(event.resultIndex, this.webLastFinalIndex);
      for (let i = startFrom; i < event.results.length; i++) {
        const chunk = (event.results[i]?.[0]?.transcript ?? '').trim();
        if (event.results[i].isFinal) {
          this.webLastFinalIndex = i + 1;
          if (chunk.length === 0) continue;
          // Extra safety net: mobile Chrome occasionally re-finalizes the same
          // trailing audio as a "new" result (especially around a restart
          // boundary) even with the index guard above. Skip it if the buffer
          // already ends with this exact phrase.
          if (this.webFinalBuffer.toLowerCase().endsWith(chunk.toLowerCase())) continue;
          this.webFinalBuffer += (this.webFinalBuffer.length > 0 ? ' ' : '') + chunk;
        } else {
          interim += chunk;
        }
      }
      const display = `${this.webFinalBuffer}${interim.length > 0 ? ' ' + interim : ''}`.trim();
      if (display.length > 0) {
        this.transcriptPreview.set(display);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // 'no-speech' and 'aborted' are non-fatal on mobile — suppress them.
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      console.warn('[VoiceSession] Web speech error:', event.error);
    };

    recognition.onend = () => {
      // Mobile Chrome silently stops continuous recognition after silence.
      // Auto-restart with a fresh instance if we haven't explicitly stopped yet.
      if (this.webActive && this.webRecognition === recognition) {
        try {
          this.startWebRecognitionInstance(Ctor);
        } catch {
          /* recognition may be unavailable right now — give up restarting silently */
        }
      }
    };

    this.webRecognition = recognition;
    recognition.start();
  }

  private stopWeb(): Promise<string> {
    this.webActive = false;
    const rec = this.webRecognition;
    if (!rec) {
      return Promise.resolve(this.transcriptPreview().trim());
    }

    const stopPromise = new Promise<string>((resolve) => {
      const finish = (): void => {
        const text = this.transcriptPreview().trim();
        this.webRecognition = undefined;
        resolve(text);
      };

      rec.onend = finish;

      try {
        rec.stop();
      } catch {
        try {
          rec.abort();
        } catch {
          finish();
        }
      }
    });

    // Mobile browsers can leave a recognition instance in a state where `stop()`
    // is a silent no-op and `onend` never fires again — without this, the UI
    // would hang on the "processing" screen forever. Fall back to whatever
    // transcript was captured so far.
    return promiseWithTimeout(stopPromise, 5_000, 'Stopping speech recognition timed out.').catch(() => {
      this.webRecognition = undefined;
      return this.transcriptPreview().trim();
    });
  }

  private abortWebSession(): void {
    this.webActive = false;
    const rec = this.webRecognition;
    this.webRecognition = undefined;
    if (!rec) return;
    try {
      rec.abort();
    } catch {
      /* noop */
    }
  }
}
