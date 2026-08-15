import { TestBed } from '@angular/core/testing';
import { CapacitorAudioRecorderWeb } from '@capgo/capacitor-audio-recorder/dist/esm/web';
import { VoiceSessionService } from '@/app/services/voice-session.service';
import { SupabaseService } from '@/app/services/supabase.service';

interface InvokeResult {
  data: unknown;
  error: unknown;
}

/**
 * Covers the record-then-transcribe session: permissions, what actually gets
 * uploaded, how failures surface, and the duration cap.
 *
 * `CapacitorAudioRecorder` is a Capacitor Proxy whose `get` trap ignores own
 * properties, so it cannot be spied on directly — every call resolves to
 * `impl[prop].bind(impl)` on the loaded web implementation. That implementation's
 * prototype is therefore the seam, the same one the previous speech-recognition
 * suite used.
 */
describe('VoiceSessionService', () => {
  let service: VoiceSessionService;
  let invokeSpy: jasmine.Spy<(name: string, options: { body: FormData }) => Promise<InvokeResult>>;
  let stopResult: { blob?: Blob; uri?: string; duration?: number };
  let amplitudeReading: number;

  /** The multipart part the service uploaded on the most recent `stop()`. */
  function uploadedFile(): File {
    const form = invokeSpy.calls.mostRecent().args[1].body;
    return form.get('file') as File;
  }

  beforeEach(() => {
    stopResult = { blob: new Blob(['audio'], { type: 'audio/webm;codecs=opus' }), duration: 4200 };
    amplitudeReading = 0;

    spyOn(CapacitorAudioRecorderWeb.prototype, 'checkPermissions').and.resolveTo({ recordAudio: 'granted' });
    spyOn(CapacitorAudioRecorderWeb.prototype, 'requestPermissions').and.resolveTo({ recordAudio: 'granted' });
    spyOn(CapacitorAudioRecorderWeb.prototype, 'startRecording').and.resolveTo();
    spyOn(CapacitorAudioRecorderWeb.prototype, 'cancelRecording').and.resolveTo();
    spyOn(CapacitorAudioRecorderWeb.prototype, 'getRecordingStatus').and.resolveTo({
      status: 'INACTIVE' as never,
    });
    spyOn(CapacitorAudioRecorderWeb.prototype, 'stopRecording').and.callFake(async () => stopResult);
    spyOn(CapacitorAudioRecorderWeb.prototype, 'getCurrentAmplitude').and.callFake(async () => ({
      value: amplitudeReading,
    }));

    invokeSpy = jasmine
      .createSpy('invoke')
      .and.resolveTo({ data: { transcript: 'bench press three sets of ten' }, error: null });

    TestBed.configureTestingModule({
      providers: [
        {
          provide: SupabaseService,
          useValue: { client: { functions: { invoke: invokeSpy } } },
        },
      ],
    });
    service = TestBed.inject(VoiceSessionService);
  });

  it('refuses to start without microphone permission, and stays idle', async () => {
    (CapacitorAudioRecorderWeb.prototype.checkPermissions as jasmine.Spy).and.resolveTo({
      recordAudio: 'denied',
    });
    (CapacitorAudioRecorderWeb.prototype.requestPermissions as jasmine.Spy).and.resolveTo({
      recordAudio: 'denied',
    });

    await expectAsync(service.start()).toBeRejectedWithError(/Microphone permission/);

    expect(CapacitorAudioRecorderWeb.prototype.startRecording).not.toHaveBeenCalled();
    expect(service.phase()).toBe('idle');
  });

  it('returns the transcript and settles back to idle', async () => {
    await service.start();
    expect(service.phase()).toBe('recording');

    await expectAsync(service.stop()).toBeResolvedTo('bench press three sets of ten');
    expect(service.phase()).toBe('idle');
  });

  it('names the upload by container, since Whisper reads the format off the extension', async () => {
    await service.start();
    await service.stop();
    // Codec parameters must not leak into the extension lookup.
    expect(uploadedFile().name).toBe('voice-log.webm');

    stopResult = { blob: new Blob(['audio'], { type: 'audio/mp4' }) };
    await service.start();
    await service.stop();
    expect(uploadedFile().name).toBe('voice-log.m4a');
  });

  it('surfaces the edge function’s own message rather than a generic failure', async () => {
    invokeSpy.and.resolveTo({
      data: null,
      error: { context: new Response(JSON.stringify({ error: 'No speech detected' }), { status: 422 }) },
    });

    await service.start();
    await expectAsync(service.stop()).toBeRejectedWithError('No speech detected');
    expect(service.phase()).toBe('idle');
  });

  it('rejects rather than uploading when the recorder produced no audio', async () => {
    stopResult = { blob: new Blob([], { type: 'audio/webm' }) };

    await service.start();
    await expectAsync(service.stop()).toBeRejectedWithError(/No audio was recorded/);
    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it('does not touch the recorder when cancelling with nothing in flight', async () => {
    await service.cancel();

    expect(CapacitorAudioRecorderWeb.prototype.cancelRecording).not.toHaveBeenCalled();
    expect(invokeSpy).not.toHaveBeenCalled();
  });

  it('discards the audio on cancel instead of transcribing it', async () => {
    (CapacitorAudioRecorderWeb.prototype.getRecordingStatus as jasmine.Spy).and.resolveTo({
      status: 'RECORDING' as never,
    });

    await service.start();
    await service.cancel();

    expect(CapacitorAudioRecorderWeb.prototype.cancelRecording).toHaveBeenCalled();
    expect(invokeSpy).not.toHaveBeenCalled();
    expect(service.phase()).toBe('idle');
  });

  describe('the live input meter', () => {
    beforeEach(() => jasmine.clock().install());
    afterEach(() => jasmine.clock().uninstall());

    /** Advances the poll loop by `samples` readings and settles each one. */
    async function poll(samples: number): Promise<void> {
      for (let i = 0; i < samples; i++) {
        jasmine.clock().tick(100);
        for (let j = 0; j < 4; j++) await Promise.resolve();
      }
    }

    it('rises toward full on a loud signal and reads near zero in silence', async () => {
      await service.start();

      amplitudeReading = 0.6;
      await poll(12);
      // The ceiling adapts to whatever the platform reports, so a sustained
      // signal normalises toward 1 regardless of its raw scale.
      expect(service.amplitude()).toBeGreaterThan(0.85);

      amplitudeReading = 0;
      await poll(12);
      expect(service.amplitude()).toBeLessThan(0.05);
    });

    it('reaches full on speech whether the platform reports RMS or peak samples', async () => {
      // The two platforms report different quantities on different scales:
      // web RMS for speech sits around 0.05–0.2, Android peak samples far
      // higher. Both must drive the meter to full rather than one of them
      // pinning it near the bottom.
      await service.start();
      amplitudeReading = 0.05;
      await poll(12);
      expect(service.amplitude()).toBeGreaterThan(0.85);
      await service.cancel();

      await service.start();
      amplitudeReading = 0.9;
      await poll(12);
      expect(service.amplitude()).toBeGreaterThan(0.85);
    });

    it('does not amplify sub-floor room noise into a visible level', async () => {
      // Below the ceiling floor the meter stays low on purpose — this is the
      // one place scale-invariance is deliberately given up, so that a silent
      // room reads as silence instead of being normalised up to full.
      await service.start();
      amplitudeReading = 0.002;
      await poll(12);

      expect(service.amplitude()).toBeLessThan(0.2);
    });

    it('stops metering once recording ends', async () => {
      await service.start();
      amplitudeReading = 0.5;
      await poll(4);
      await service.stop();

      const callsAfterStop = (
        CapacitorAudioRecorderWeb.prototype.getCurrentAmplitude as jasmine.Spy
      ).calls.count();
      await poll(5);

      expect(service.amplitude()).toBe(0);
      expect((CapacitorAudioRecorderWeb.prototype.getCurrentAmplitude as jasmine.Spy).calls.count()).toBe(
        callsAfterStop,
      );
    });

    it('drops the meter rather than the recording when metering is unavailable', async () => {
      (CapacitorAudioRecorderWeb.prototype.getCurrentAmplitude as jasmine.Spy).and.rejectWith(
        new Error('not supported'),
      );

      await service.start();
      await poll(3);

      expect(service.phase()).toBe('recording');
      expect(service.amplitude()).toBe(0);
    });
  });

  describe('the recording duration cap', () => {
    beforeEach(() => jasmine.clock().install());
    afterEach(() => jasmine.clock().uninstall());

    /** Lets the halt's promise chain settle while the clock is mocked. */
    async function flush(): Promise<void> {
      for (let i = 0; i < 8; i++) await Promise.resolve();
    }

    it('halts the recorder at the cap and keeps the audio for the pending stop', async () => {
      await service.start();

      jasmine.clock().tick(3 * 60 * 1000 + 1);
      await flush();

      expect(service.limitReached()).toBeTrue();
      expect(CapacitorAudioRecorderWeb.prototype.stopRecording).toHaveBeenCalledTimes(1);

      // The audio captured before the cap is still transcribed — the recorder is
      // not asked for a second result it no longer has.
      await expectAsync(service.stop()).toBeResolvedTo('bench press three sets of ten');
      expect(CapacitorAudioRecorderWeb.prototype.stopRecording).toHaveBeenCalledTimes(1);
      expect(service.limitReached()).toBeFalse();
    });

    it('does not halt a recording that was stopped before the cap', async () => {
      await service.start();
      await service.stop();

      jasmine.clock().tick(3 * 60 * 1000 + 1);
      await flush();

      expect(service.limitReached()).toBeFalse();
      expect(CapacitorAudioRecorderWeb.prototype.stopRecording).toHaveBeenCalledTimes(1);
    });
  });
});
