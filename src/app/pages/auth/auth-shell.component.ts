import { Component } from '@angular/core';
import { IonRouterOutlet } from '@ionic/angular/standalone';

/**
 * Hosts /auth/* child routes (welcome, login, register, onboarding).
 * Must use IonRouterOutlet so each page gets Ionic's full-height .ion-page layout.
 */
@Component({
  selector: 'app-auth-shell',
  standalone: true,
  template: '<ion-router-outlet></ion-router-outlet>',
  imports: [IonRouterOutlet],
  styles: [
    `
      :host {
        display: block;
        height: 100%;
      }
    `,
  ],
})
export class AuthShellComponent {}
