import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SpeechDemoService {
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /**
   * Speaks `text` aloud. Calls `onWordBoundary(charIndex, charLength)` as each
   * word is reached, and `onEnd()` when playback finishes or is cancelled.
   * Returns a function that stops playback early.
   */
  speak(
    text: string,
    onWordBoundary: (charIndex: number, charLength: number) => void,
    onEnd: () => void,
  ): () => void {
    if (!this.isSupported()) {
      onEnd();
      return () => {};
    }

    window.speechSynthesis.cancel(); // never let two demos overlap

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.92;
    utterance.pitch = 1;

    utterance.onboundary = (event: SpeechSynthesisEvent) => {
      if (event.name === 'word') {
        onWordBoundary(event.charIndex, event.charLength ?? 0);
      }
    };
    utterance.onend = () => onEnd();
    utterance.onerror = () => onEnd();

    window.speechSynthesis.speak(utterance);

    return () => window.speechSynthesis.cancel();
  }
}
