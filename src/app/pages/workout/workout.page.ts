import { Component, signal } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonBackButton,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBackOutline } from 'ionicons/icons';
import {
  DUMMY_WEEKLY_VOLUME,
  DUMMY_WORKOUT_DETAIL,
  DUMMY_WORKOUT_SESSIONS,
} from '@/app/data';

addIcons({ chevronBackOutline });

@Component({
  selector: 'app-workout',
  standalone: true,
  templateUrl: './workout.page.html',
  styleUrls: ['./workout.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonButtons, IonBackButton, IonIcon],
})
export class WorkoutPage {
  protected readonly sessions = DUMMY_WORKOUT_SESSIONS;
  protected readonly weekly = DUMMY_WEEKLY_VOLUME;
  protected readonly detail = DUMMY_WORKOUT_DETAIL;

  protected readonly view = signal<'list' | 'detail'>('list');
  protected readonly activeFilter = signal<'all' | 'week' | 'prs'>('all');

  protected readonly filters = [
    { id: 'all' as const, label: 'All' },
    { id: 'week' as const, label: 'This Week' },
    { id: 'prs' as const, label: 'PRs Only' },
  ];

  protected openDetail(): void {
    this.view.set('detail');
  }

  protected goList(): void {
    this.view.set('list');
  }
}
