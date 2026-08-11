import { TestBed } from '@angular/core/testing';
import { Capacitor, WebPlugin, type PluginListenerHandle } from '@capacitor/core';
import { SpeechRecognitionWeb } from '@capacitor-community/speech-recognition/dist/esm/web';
import { VoiceSessionService } from '@/app/services/voice-session.service';

type PartialResultsListener = (data: { matches: string[] }) => void;
type ListeningStateListener = (data: { status: 'started' | 'stopped' }) => void;

/**
 * Drives the native plug-in the way Android actually does: partials arrive for
 * the *current* recogniser session only, and a silence gap ends that session
 * (a `listeningState: 'stopped'` event) without the user having pressed stop.
 *
 * The `SpeechRecognition` export is a Capacitor Proxy whose `get` trap ignores
 * own properties, so it cannot be spied on directly. Every proxy call resolves
 * to `impl[prop].bind(impl)` on the loaded web implementation, so the seam is
 * that implementation's prototype.
 */
describe('VoiceSessionService (native path)', () => {
  let service: VoiceSessionService;
  let partialListeners: PartialResultsListener[];
  let listeningStateListeners: ListeningStateListener[];
  let startCalls: number;

  /** Android emits a growing partial per utterance within one session. */
  function emitPartial(text: string): void {
    for (const l of partialListeners) l({ matches: [text] });
  }

  /** The silence timeout firing — session over, user never asked for it. */
  async function emitSessionStopped(): Promise<void> {
    for (const l of listeningStateListeners) l({ status: 'stopped' });
    /* Let the restart's promise chain settle. */
    await Promise.resolve();
    await Promise.resolve();
  }

  beforeEach(async () => {
    partialListeners = [];
    listeningStateListeners = [];
    startCalls = 0;

    spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
    spyOn(SpeechRecognitionWeb.prototype, 'requestPermissions').and.resolveTo({
      speechRecognition: 'granted',
    });
    spyOn(SpeechRecognitionWeb.prototype, 'available').and.resolveTo({ available: true });
    spyOn(SpeechRecognitionWeb.prototype, 'stop').and.resolveTo();
    spyOn(SpeechRecognitionWeb.prototype, 'start').and.callFake(async () => {
      startCalls += 1;
      return {};
    });
    spyOn(WebPlugin.prototype, 'removeAllListeners').and.resolveTo();
    spyOn(WebPlugin.prototype, 'addListener').and.callFake(
      (eventName: string, listenerFunc: unknown): Promise<PluginListenerHandle> => {
        if (eventName === 'partialResults') partialListeners.push(listenerFunc as PartialResultsListener);
        if (eventName === 'listeningState') listeningStateListeners.push(listenerFunc as ListeningStateListener);
        return Promise.resolve({ remove: () => Promise.resolve() });
      },
    );

    TestBed.configureTestingModule({});
    service = TestBed.inject(VoiceSessionService);
    await service.start();
  });

  it('restarts recognition when a silence gap ends the session', async () => {
    emitPartial('bench press three sets');
    await emitSessionStopped();

    expect(startCalls).toBe(2);
  });

  it('keeps pre-pause speech when the post-pause session overwrites partials', async () => {
    emitPartial('bench press three sets');
    await emitSessionStopped();

    /* Fresh session — Android restarts its partial from scratch, it is NOT a
       continuation of the previous string. */
    emitPartial('then ten reps');

    expect(service.transcriptPreview()).toBe('bench press three sets then ten reps');
  });

  it('returns the whole transcript across a pause, not just the pre-pause part', async () => {
    emitPartial('bench press three sets');
    await emitSessionStopped();
    emitPartial('then ten reps');

    await expectAsync(service.stop()).toBeResolvedTo('bench press three sets then ten reps');
  });

  it('does not restart after the user explicitly stops', async () => {
    emitPartial('bench press three sets');
    const callsBeforeStop = startCalls;

    await service.stop();
    /* The plug-in reports the stop it was asked for; that must not re-arm. */
    await emitSessionStopped();

    expect(startCalls).toBe(callsBeforeStop);
  });

  it('keeps speech across several pauses, not just the first', async () => {
    emitPartial('bench press');
    await emitSessionStopped();
    emitPartial('then ten reps');
    await emitSessionStopped();
    emitPartial('then squats');

    expect(service.transcriptPreview()).toBe('bench press then ten reps then squats');
  });

  it('ignores a silence-gap stop that carried no speech', async () => {
    emitPartial('bench press');
    await emitSessionStopped();
    /* User stayed quiet through a whole session — no empty gap in the text. */
    await emitSessionStopped();
    emitPartial('then squats');

    expect(service.transcriptPreview()).toBe('bench press then squats');
  });
});
