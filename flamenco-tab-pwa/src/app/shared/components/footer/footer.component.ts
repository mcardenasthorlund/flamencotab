import { Component } from '@angular/core';
import { APP_VERSION } from '../../../core/constants/app-version.constant';

@Component({
  selector: 'app-footer',
  standalone: true,
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss',
})
export class FooterComponent {
  readonly version = APP_VERSION;
}