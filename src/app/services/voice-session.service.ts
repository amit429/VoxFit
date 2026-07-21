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

function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Exact match only, modulo case/punctuation/whitespace — deliberately NOT
 * fuzzy (no substring-containment, no word-overlap ratio). An earlier version
 * of this used fuzzy matching (one phrase containing the other, or >70% word
 * overlap) and it was a real regression: workout logging is full of short,
 * legitimately-repeated phrases ("3 sets", "10 reps" for one exercise then
 * again for the next), and that fuzzy check silently dropped real content —
 * users reported voice logging "not working at all" on mobile because most
 * of the transcript was being eaten as a false-positive "duplicate".
 */
function isExactDuplicate(a: string, b: string): boolean {
  const na = normalizeForCompare(a);
  const nb = normalizeForCompare(b);
  return na.length > 0 && na === nb;
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
  /**
   * Final segments keyed by a *global* index spanning every recognition instance
   * in this recording (see `webIndexOffset`). Written with plain assignment
   * (`segments[i] = text`), never appended — so re-processing the same index
   * any number of times (mobile Chrome's `resultIndex` is unreliable) is a
   * no-op instead of a duplicate. The displayed transcript is rebuilt by
   * joining this array fresh on every event, rather than mutating a running
   * string, which is what made the old approach fragile.
   */
  private webFinalSegments: string[] = [];
  /** This instance's local result index 0 maps to `webFinalSegments[webIndexOffset]`. */
  private webIndexOffset = 0;
  /**
   * Set to the last committed segment whenever a fresh instance starts (i.e.
   * only at a restart boundary), and cleared after the new instance's first
   * final result is checked against it. Mobile Chrome sometimes re-transcribes
   * the same trailing audio right after restarting continuous recognition —
   * this catches *that* specific, narrow case without touching dedup logic
   * for the rest of the recording (see `isExactDuplicate`'s comment for why
   * broader fuzzy dedup was actively harmful here).
   */
  private webBoundaryCheckSegment: string | null = null;
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
    this.webFinalSegments = [];
    this.webIndexOffset = 0;
    this.webBoundaryCheckSegment = null;

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
   * instance rather than restarting the ended one. `webIndexOffset` is set to
   * however many segments are already committed, so this instance's own
   * local index 0 maps to the next free slot in `webFinalSegments` instead of
   * colliding with (and overwriting) earlier content.
   */
  private startWebRecognitionInstance(Ctor: SpeechRecognitionConstructor): void {
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    this.webIndexOffset = this.webFinalSegments.length;
    // Only set on a restart (webIndexOffset > 0 means segments already exist);
    // the very first instance of a recording has nothing to check against.
    this.webBoundaryCheckSegment =
      this.webIndexOffset > 0 ? (this.webFinalSegments[this.webFinalSegments.length - 1] ?? null) : null;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      // Deliberately ignore event.resultIndex and rescan the whole array every
      // time — mobile Chrome reports it unreliably (sometimes 0 on every
      // event), but since writes below are plain index assignment (not
      // append), reprocessing an already-final index is a harmless no-op.
      for (let i = 0; i < event.results.length; i++) {
        const globalIndex = this.webIndexOffset + i;
        const chunk = (event.results[i]?.[0]?.transcript ?? '').trim();
        if (event.results[i].isFinal) {
          if (chunk.length === 0) continue;
          // Only ever checked against the *single* segment right at a
          // restart boundary, and only once (cleared immediately after) —
          // never against general recording history. See the class field's
          // comment and `isExactDuplicate`'s comment for why.
          if (this.webBoundaryCheckSegment !== null) {
            const isBoundaryDup = isExactDuplicate(this.webBoundaryCheckSegment, chunk);
            this.webBoundaryCheckSegment = null;
            if (isBoundaryDup) continue;
          }
          this.webFinalSegments[globalIndex] = chunk;
        } else {
          interim += chunk;
        }
      }
      const finalText = this.webFinalSegments.filter(Boolean).join(' ');
      const display = `${finalText}${interim.length > 0 ? ' ' + interim : ''}`.trim();
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
