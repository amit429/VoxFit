import { flagsSummary } from '@/app/utils/workout-display.util';

describe('flagsSummary', () => {
  it('reports no flags for null, empty, and whitespace-only input', () => {
    for (const input of [null, undefined, [], ['', '   ']]) {
      expect(flagsSummary(input).hasFlags).toBe(false);
    }
  });

  it('reports flags when at least one is non-empty', () => {
    expect(flagsSummary(['', 'left knee tight']).hasFlags).toBe(true);
  });

  it('joins multiple notes', () => {
    expect(flagsSummary(['knee', 'shoulder']).body).toBe('knee · shoulder');
  });

  /*
   * Framing guard, not a formatting preference. The AI Coach PRD requires
   * observational wording — the underlying data is free text captured mid-set
   * by unreliable speech recognition, so clinical register implies an
   * assessment the data cannot support.
   */
  it('uses observational wording, never clinical register', () => {
    const withFlags = flagsSummary(['knee']);
    const without = flagsSummary([]);

    for (const result of [withFlags, without]) {
      const text = `${result.title} ${result.body}`.toLowerCase();
      for (const banned of ['flag', 'diagnos', 'healthcare', 'health', 'injur', 'symptom', 'issue']) {
        expect(text).not.toContain(banned);
      }
    }
  });
});
