import { provideAppInitializer, inject } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import { routes } from '@/app/app.routes';
import { AppComponent } from '@/app/app.component';
import { AuthService } from '@/app/services/auth.service';

bootstrapApplication(AppComponent, {
  providers: [
    provideAppInitializer(() => inject(AuthService).init()),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
  ],
});
