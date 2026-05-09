import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ViewWillEnter } from '@ionic/angular/standalone';
import { IonContent, IonRouterLinkWithHref } from '@ionic/angular/standalone';
import { DUMMY_HOME_MACROS, DUMMY_PROFILE_DISPLAY } from '@/app/data';
import { AuthService } from '@/app/services/auth.service';
import { WorkoutJournalService } from '@/app/services/workout-journal.service';

@Component({
  selector: 'app-home',
  standalone: true,
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  imports: [IonContent, RouterLink, IonRouterLinkWithHref],
})
export class HomePage implements ViewWillEnter {
  protected readonly auth = inject(AuthService);
  protected readonly journal = inject(WorkoutJournalService);

  protected readonly macros = DUMMY_HOME_MACROS;

  protected readonly greeting = signal(this.pickGreeting());
  protected readonly displayName = computed(() => {
    const n = this.auth.profile()?.display_name?.trim();
    if (n) return n.split(/\s+/)[0] ?? n;
    return DUMMY_PROFILE_DISPLAY.name.split(/\s+/)[0] ?? 'Athlete';
  });

  protected readonly initial = computed(() => {
    const n = this.auth.profile()?.display_name?.trim();
    if (n) return n.charAt(0).toUpperCase();
    return DUMMY_PROFILE_DISPLAY.initial;
  });

  ionViewWillEnter(): void {
    void this.journal.refresh();
  }

  protected macroPct(row: { current: number; target: number }): number {
    return Math.min(100, Math.round((row.current / row.target) * 100));
  }

  private pickGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }
}
