import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { PwaUpdateService } from '../../../core/services/pwa-update.service';
import { APP_VERSION } from '../../../core/constants/app-version.constant';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  readonly version = APP_VERSION;
  readonly updateAvailable = signal(false);
  private updateSub: unknown;

  constructor(private pwaUpdate: PwaUpdateService) {
    this.updateSub = this.pwaUpdate.updateAvailable$.subscribe((available) =>
      this.updateAvailable.set(available)
    );
  }

  refreshApp(): void {
    this.pwaUpdate.activateUpdate();
  }
}