import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonTabs,
  IonTabBar,
  IonTabButton,
  IonIcon,
  IonLabel,
  IonRouterLink,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { homeOutline, barbellOutline, nutritionOutline, personOutline } from 'ionicons/icons';

addIcons({ homeOutline, barbellOutline, nutritionOutline, personOutline });

@Component({
  selector: 'app-tabs',
  standalone: true,
  templateUrl: './tabs.page.html',
  styleUrls: ['./tabs.page.scss'],
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, RouterLink, RouterLinkActive, IonRouterLink],
})
export class TabsPage {}
