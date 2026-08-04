import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { App, type URLOpenListenerEvent } from '@capacitor/app';
import { AuthService } from '@/app/services/auth.service';
import { parseAuthCallbackUrl, resolvePostAuthRoute } from '@/app/utils/auth-redirect.util';

@Injectable({ providedIn: 'root' })
export class DeepLinkService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async init(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }
    await App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
      void this.handleUrlOpen(event.url);
    });
  }

  private async handleUrlOpen(url: string): Promise<void> {
    const parsed = parseAuthCallbackUrl(url);
    if (!parsed) {
      await this.router.navigateByUrl('/auth/login?authError=expired');
      return;
    }
    try {
      await this.auth.setSessionFromTokens(parsed.accessToken, parsed.refreshToken);
    } catch {
      await this.router.navigateByUrl('/auth/login?authError=expired');
      return;
    }
    await this.router.navigateByUrl(resolvePostAuthRoute(parsed.type));
  }
}
