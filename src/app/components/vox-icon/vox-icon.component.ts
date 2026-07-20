import { Component, input } from '@angular/core';
import { NgClass } from '@angular/common';
import { IonIcon } from '@ionic/angular/standalone';

export type VoxIconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type VoxIconTone =
  | 'inherit'
  | 'ink'
  | 'ink-muted'
  | 'ink-subtle'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger';

/**
 * Thin wrapper around ion-icon that ties size/color to the token system,
 * so icon sizing/coloring stops being ad hoc per-template. Register the
 * ionicon with `addIcons()` in the consuming component as usual — this
 * wrapper only standardizes presentation, not the icon registry.
 */
@Component({
  selector: 'vox-icon',
  standalone: true,
  imports: [IonIcon, NgClass],
  templateUrl: './vox-icon.component.html',
  styleUrl: './vox-icon.component.scss',
})
export class VoxIconComponent {
  readonly name = input.required<string>();
  readonly size = input<VoxIconSize>('md');
  readonly tone = input<VoxIconTone>('inherit');
}
