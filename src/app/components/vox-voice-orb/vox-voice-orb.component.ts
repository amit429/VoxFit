import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';

export type VoxVoiceOrbState = 'idle' | 'listening' | 'processing';
export type VoxVoiceOrbSize = 'md' | 'lg';

/** Bar heights (px) for the listening waveform, mirroring the mockup's rhythm. */
const WAVE_HEIGHTS = [14, 26, 40, 22, 34, 16, 28, 11] as const;

/**
 * The signature element of the redesign — the periwinkle voice sphere with
 * concentric rings.
 *
 * This is the only element in the app permitted `--vox-glow-orb`. Everywhere
 * else, separation comes from the card rim-light and hairline borders; adding
 * halos elsewhere is what turns this system into a neon carnival.
 *
 * Purely presentational: it renders state, it does not own recording. The
 * host page keeps the hold-to-record interaction.
 */
@Component({
  selector: 'vox-voice-orb',
  standalone: true,
  imports: [NgClass, VoxIconComponent],
  templateUrl: './vox-voice-orb.component.html',
  styleUrl: './vox-voice-orb.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoxVoiceOrbComponent {
  readonly state = input<VoxVoiceOrbState>('idle');
  readonly size = input<VoxVoiceOrbSize>('md');

  protected readonly waveBars = WAVE_HEIGHTS.map((height, i) => ({
    height,
    /* Staggered negative delays so the bars never move as one block. */
    delay: `${-(i * 90)}ms`,
  }));

  protected readonly label = computed(() => {
    switch (this.state()) {
      case 'listening':
        return 'Listening';
      case 'processing':
        return 'Processing your workout';
      default:
        return 'Tap to record your workout';
    }
  });
}
