import { findSpokenWordIndex } from './tour-word-highlight.util';

// Real "Hear an example" transcripts from the walkthrough content — see
// TourService's SAY_CONTENT — so these tests double as a regression guard on
// that content, not just the offset math.
const WORKOUT_EXAMPLE =
  'Three sets of squats, sixty kilos for ten, seventy for eight, eighty for six. Legs felt strong.';
const MAKE_MEAL_EXAMPLE =
  "I've got chicken, spinach, and eggs. Craving something spicy, and I need more protein today.";
const ATE_MEAL_EXAMPLE = 'Two eggs, a bowl of oats, and a banana for breakfast.';

describe('findSpokenWordIndex', () => {
  it('maps charIndex 0 to the first word', () => {
    expect(findSpokenWordIndex(WORKOUT_EXAMPLE, 0)).toBe(0);
  });

  it('stays on the current word for any charIndex inside it, not just its first character', () => {
    const wordIndex = 5; // "kilos"
    const start = WORKOUT_EXAMPLE.split(' ').slice(0, wordIndex).join(' ').length + 1;
    expect(findSpokenWordIndex(WORKOUT_EXAMPLE, start)).toBe(wordIndex);
    expect(findSpokenWordIndex(WORKOUT_EXAMPLE, start + 2)).toBe(wordIndex);
  });

  it('advances to the next word exactly at its first character', () => {
    const wordIndex = 5; // "kilos" -> "for"
    const nextStart = WORKOUT_EXAMPLE.split(' ').slice(0, wordIndex + 1).join(' ').length + 1;
    expect(findSpokenWordIndex(WORKOUT_EXAMPLE, nextStart - 1)).toBe(wordIndex);
    expect(findSpokenWordIndex(WORKOUT_EXAMPLE, nextStart)).toBe(wordIndex + 1);
  });

  it('maps the last word (including trailing punctuation) correctly', () => {
    const words = WORKOUT_EXAMPLE.split(' ');
    const lastIndex = words.length - 1;
    const lastStart = words.slice(0, lastIndex).join(' ').length + 1;
    expect(findSpokenWordIndex(WORKOUT_EXAMPLE, lastStart)).toBe(lastIndex);
  });

  it('clamps a charIndex past the end of the string to the last word', () => {
    const words = WORKOUT_EXAMPLE.split(' ');
    expect(findSpokenWordIndex(WORKOUT_EXAMPLE, WORKOUT_EXAMPLE.length + 50)).toBe(words.length - 1);
  });

  it('handles the real make-meal and ate-meal example transcripts word-by-word', () => {
    for (const text of [MAKE_MEAL_EXAMPLE, ATE_MEAL_EXAMPLE]) {
      const words = text.split(' ');
      let cursor = 0;
      words.forEach((word, i) => {
        expect(findSpokenWordIndex(text, cursor)).toBe(i);
        cursor += word.length + 1;
      });
    }
  });
});
