import { Component, input } from '@angular/core';
import { NgClass } from '@angular/common';

export type VoxSkeletonShape = 'block' | 'circle' | 'pill' | 'text';
export type VoxSkeletonSurface = 'surface-2' | 'surface-3' | 'surface-4';
export type VoxSkeletonRadius = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Shared loading placeholder — one primitive every page composes skeleton
 * layouts from instead of hand-rolling shimmer CSS per page.
 */
@Component({
  selector: 'vox-skeleton',
  standalone: true,
  imports: [NgClass],
  templateUrl: './vox-skeleton.component.html',
  styleUrl: './vox-skeleton.component.scss',
})
export class VoxSkeletonComponent {
  readonly shape = input<VoxSkeletonShape>('block');
  readonly surface = input<VoxSkeletonSurface>('surface-3');
  readonly width = input('100%');
  readonly height = input('1rem');
  readonly radius = input<VoxSkeletonRadius>('md');
}
