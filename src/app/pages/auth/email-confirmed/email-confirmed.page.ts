import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { VoxPageHeaderComponent } from '@/app/components/vox-page-header/vox-page-header.component';
import { AuthService } from '@/app/services/auth.service';

const AUTO_ADVANCE_DELAY_MS = 1500;

@Component({
  selector: 'app-email-confirmed',
  standalone: true,
  templateUrl: './email-confirmed.page.html',
  styleUrls: ['./email-confirmed.page.scss'],
  imports: [VoxPageHeaderComponent, IonContent],
})
export class EmailConfirmedPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  constructor() {
    setTimeout(() => {
      const completed = this.auth.profile()?.onboarding_completed ?? false;
      void this.router.navigateByUrl(completed ? '/tabs/home' : '/auth/onboarding');
    }, AUTO_ADVANCE_DELAY_MS);
  }
}
