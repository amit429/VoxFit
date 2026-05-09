import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonIcon,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { micOutline, arrowForwardOutline } from 'ionicons/icons';

addIcons({ micOutline, arrowForwardOutline });

@Component({
  selector: 'app-welcome',
  standalone: true,
  templateUrl: './welcome.page.html',
  styleUrls: ['./welcome.page.scss'],
  imports: [IonContent, IonIcon, RouterLink],
})
export class WelcomePage {}
