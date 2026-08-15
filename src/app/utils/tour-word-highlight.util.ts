/**
 * Maps a `SpeechSynthesisUtterance` `boundary` event's `charIndex` (an offset
 * into the plain-text string being spoken) back to the index of the word it
 * falls within, for karaoke-style highlighting of a transcript rendered as
 * one `<span>` per space-separated word.
 */
export function findSpokenWordIndex(text: string, charIndex: number): number {
  const words = text.split(' ');
  const offsets: number[] = [];
  let cursor = 0;
  for (const word of words) {
    offsets.push(cursor);
    cursor += word.length + 1; // +1 for the joining space
  }

  const index = offsets.findIndex((start, i) => {
    const next = offsets[i + 1] ?? Infinity;
    return charIndex >= start && charIndex < next;
  });
  return index === -1 ? 0 : index;
}
