import { Component, OnDestroy, signal } from '@angular/core';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton } from '@ionic/angular/standalone';
import { DUMMY_DIET_MEALS, DUMMY_DIET_MACROS } from '@/app/data';

@Component({
  selector: 'app-diet',
  standalone: true,
  templateUrl: './diet.page.html',
  styleUrls: ['./diet.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton],
})
export class DietPage implements OnDestroy {
  protected readonly dietMacros = DUMMY_DIET_MACROS;
  protected readonly meals = DUMMY_DIET_MEALS;

  protected readonly dietFlow = signal<'idle' | 'voice' | 'results'>('idle');
  protected readonly loggedMeal = signal<number | null>(null);

  private voiceTimer?: ReturnType<typeof setTimeout>;

  ngOnDestroy(): void {
    if (this.voiceTimer) clearTimeout(this.voiceTimer);
  }

  protected macroPct(row: { current: number; target: number }): number {
    return Math.min(100, Math.round((row.current / row.target) * 100));
  }

  protected startVoice(): void {
    this.dietFlow.set('voice');
    if (this.voiceTimer) clearTimeout(this.voiceTimer);
    this.voiceTimer = setTimeout(() => this.dietFlow.set('results'), 2200);
  }

  protected logMeal(index: number): void {
    this.loggedMeal.set(this.loggedMeal() === index ? null : index);
  }
}
