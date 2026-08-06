import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { NavigationEnd, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { filter, take } from 'rxjs';

/** Top stop of `--vox-canvas-gradient`, so system chrome continues the page. */
const CANVAS_TOP = '#1c1536';

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

    void this.applySystemChrome();
  }

  /**
   * Match the Android status bar to the canvas so the system strip doesn't sit
   * as a lighter band above a dark gradient. Native-only: the plugin is a
   * no-op on web, but calling it there still logs a warning per navigation.
   */
  private async applySystemChrome(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: CANVAS_TOP });
    } catch (err) {
      /* Not fatal — the app just keeps the platform default chrome. */
      console.error('[AppComponent] status bar', err);
    }
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
