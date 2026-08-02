import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { addIcons } from 'ionicons';
import { chevronForwardOutline } from 'ionicons/icons';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';

addIcons({ chevronForwardOutline });

/**
 * Passive Home pointer to a coach surface (Profile check-in / Train nudge). It only
 * navigates — the content and its acknowledge action live on the destination card.
 * Calm register: single accent on the leading glyph, no alert styling.
 */
@Component({
  selector: 'vox-coach-pointer-card',
  standalone: true,
  imports: [RouterLink, VoxIconComponent],
  template: `
    <a
      [routerLink]="link()"
      class="flex items-center gap-3 rounded-xl bg-surface-1 p-4 no-underline ring-1 ring-hairline transition-all active:scale-[0.99]"
    >
      <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 ring-1 ring-hairline">
        <vox-icon [name]="icon()" tone="accent" size="sm" />
      </span>
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-medium text-ink">{{ title() }}</span>
        <span class="block truncate text-xs text-ink-subtle">{{ subtitle() }}</span>
      </span>
      <vox-icon name="chevron-forward-outline" tone="ink-subtle" size="xs" />
    </a>
  `,
})
export class CoachPointerCardComponent {
  readonly title = input.required<string>();
  readonly subtitle = input.required<string>();
  readonly link = input.required<string | unknown[]>();
  readonly icon = input<string>('sparkles-outline');
}
