import { Component, signal } from '@angular/core';
import { IonContent } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  micOutline,
  sparklesOutline,
  trendingUpOutline,
  chatbubbleEllipsesOutline,
  listOutline,
  moonOutline,
  chevronForwardOutline,
  closeOutline,
  checkmarkOutline,
  barbellOutline,
  restaurantOutline,
  statsChartOutline,
} from 'ionicons/icons';
import { VoxVoiceOrbComponent } from '@/app/components/vox-voice-orb/vox-voice-orb.component';
import { VoxStreakPillComponent } from '@/app/components/vox-streak-pill/vox-streak-pill.component';
import { VoxStatTileComponent } from '@/app/components/vox-stat-tile/vox-stat-tile.component';
import { VoxQuickActionGridComponent } from '@/app/components/vox-quick-action-grid/vox-quick-action-grid.component';
import { VoxPlanBannerComponent } from '@/app/components/vox-plan-banner/vox-plan-banner.component';
import { VoxProgressNudgeComponent } from '@/app/components/vox-progress-nudge/vox-progress-nudge.component';
import { VoxMacroRingComponent } from '@/app/components/vox-macro-ring/vox-macro-ring.component';
import { VoxActivityRingComponent } from '@/app/components/vox-activity-ring/vox-activity-ring.component';
import { VoxVolumeChartComponent } from '@/app/components/vox-volume-chart/vox-volume-chart.component';
import { VoxTrendChartComponent } from '@/app/components/vox-trend-chart/vox-trend-chart.component';
import { VoxHeatmapComponent } from '@/app/components/vox-heatmap/vox-heatmap.component';
import { VoxBadgeShelfComponent } from '@/app/components/vox-badge-shelf/vox-badge-shelf.component';
import { VoxSegmentedComponent } from '@/app/components/vox-segmented/vox-segmented.component';
import { VoxDateScrubberComponent } from '@/app/components/vox-date-scrubber/vox-date-scrubber.component';
import { VoxStepperRowComponent } from '@/app/components/vox-stepper-row/vox-stepper-row.component';
import { VoxCardComponent } from '@/app/components/vox-card/vox-card.component';
import { VoxBadgeComponent } from '@/app/components/vox-badge/vox-badge.component';
import { getCurrentWeekDayKeys, parseLocalDateKey } from '@/app/utils/workout-display.util';
import type { HeatmapCellVm, VoxEarnedBadge, VoxQuickAction, VoxTrendPoint, VoxVolumeBar } from '@/app/models';

addIcons({
  micOutline,
  sparklesOutline,
  trendingUpOutline,
  chatbubbleEllipsesOutline,
  listOutline,
  moonOutline,
  chevronForwardOutline,
  closeOutline,
  checkmarkOutline,
  barbellOutline,
  restaurantOutline,
  statsChartOutline,
});

/**
 * Development-only component gallery. Not routed in production builds — it
 * exists so every primitive can be eyeballed in isolation against the tokens
 * without needing seeded data on a real screen.
 */
@Component({
  selector: 'app-gallery',
  standalone: true,
  templateUrl: './gallery.page.html',
  imports: [
    IonContent,
    VoxVoiceOrbComponent,
    VoxStreakPillComponent,
    VoxStatTileComponent,
    VoxQuickActionGridComponent,
    VoxPlanBannerComponent,
    VoxProgressNudgeComponent,
    VoxMacroRingComponent,
    VoxActivityRingComponent,
    VoxVolumeChartComponent,
    VoxTrendChartComponent,
    VoxHeatmapComponent,
    VoxBadgeShelfComponent,
    VoxSegmentedComponent,
    VoxDateScrubberComponent,
    VoxStepperRowComponent,
    VoxCardComponent,
    VoxBadgeComponent,
  ],
})
export class GalleryPage {
  protected readonly segment = signal<'day' | 'week' | 'month'>('week');
  protected readonly scrubDay = signal(parseLocalDateKey(new Date()));
  protected readonly calories = signal(2000);
  protected readonly weekKeys = getCurrentWeekDayKeys();

  protected readonly quickActions: VoxQuickAction[] = [
    { icon: 'barbell-outline', label: ['log', 'workout'], link: '/voice', tone: 'jade' },
    { icon: 'restaurant-outline', label: ['log', 'meal'], link: '/log-diet', tone: 'apricot' },
    { icon: 'list-outline', label: ['my', 'plan'], link: '/tabs/workout', tone: 'brand' },
    { icon: 'stats-chart-outline', label: ['my', 'progress'], link: '/tabs/profile', tone: 'slate' },
  ];

  protected readonly volumeBars: VoxVolumeBar[] = [
    { label: 'M', value: 3200 },
    { label: 'T', value: 5800 },
    { label: 'W', value: 4400 },
    { label: 'T', value: 7800, isToday: true },
    { label: 'F', value: 6100 },
    { label: 'S', value: 9600 },
    { label: 'S', value: 1600 },
  ];

  protected readonly trendPoints: VoxTrendPoint[] = [
    { label: 'W1', value: 60 },
    { label: 'W2', value: 62.5 },
    { label: 'W3', value: 62.5 },
    { label: 'W4', value: 67.5, isPr: true },
    { label: 'W5', value: 70 },
    { label: 'W6', value: 70 },
    { label: 'W7', value: 75, isPr: true },
    { label: 'NOW', value: 80, isPr: true },
  ];

  protected readonly badges: VoxEarnedBadge[] = [
    { key: 'streak_14', emoji: '🔥', label: '14 DAYS', earned: true, tone: 'apricot' },
    { key: 'pr_10', emoji: '💪', label: '10 PRs', earned: true, tone: 'jade' },
    { key: 'logs_50', emoji: '🎙️', label: '50 LOGS', earned: true, tone: 'brand' },
    { key: 'logs_100', emoji: '🏛️', label: '100 LOGS', earned: false, tone: 'brand' },
    { key: 'streak_30', emoji: '⚡', label: '30 DAYS', earned: false, tone: 'apricot' },
  ];

  /** Deterministic ramp so the gallery render is stable between screenshots. */
  protected readonly heatCells: HeatmapCellVm[] = Array.from({ length: 26 * 7 }, (_, i) => {
    const week = Math.floor(i / 7);
    const pseudo = (i * 2654435761) % 100;
    const density = 18 + (week / 25) * 54;
    const intensity = pseudo < density ? ((pseudo % 4) as 0 | 1 | 2 | 3 | 4) : 0;
    return { key: `c${i}`, intensity, isToday: i === 26 * 7 - 1 };
  });

  protected readonly segments = [
    { id: 'day' as const, label: 'Day' },
    { id: 'week' as const, label: 'Week' },
    { id: 'month' as const, label: 'Month' },
  ];
}
