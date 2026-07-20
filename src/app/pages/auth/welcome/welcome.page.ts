import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { micOutline, arrowForwardOutline } from 'ionicons/icons';
import { VoxIconComponent } from '@/app/components/vox-icon/vox-icon.component';

addIcons({ micOutline, arrowForwardOutline });

@Component({
  selector: 'app-welcome',
  standalone: true,
  templateUrl: './welcome.page.html',
  styleUrls: ['./welcome.page.scss'],
  imports: [IonContent, RouterLink, VoxIconComponent],
})
export class WelcomePage {}
