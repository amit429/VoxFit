import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { NavigationEnd, Router } from '@angular/router';
import { filter, take } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  constructor() {
    const router = inject(Router);
    router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        take(1),
      )
      .subscribe(() => this.hideSplash());
  }

  /** Splash lives in index.html (outside the Angular tree) so it can paint before bootstrap finishes. */
  private hideSplash(): void {
    const splash = document.getElementById('app-splash');
    if (!splash) {
      return;
    }
    splash.classList.add('app-splash-hidden');
    splash.addEventListener('transitionend', () => splash.remove(), { once: true });
  }
}
