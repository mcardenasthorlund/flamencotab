import { Component, inject, OnDestroy, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/components/header/header.component';
import { FooterComponent } from './shared/components/footer/footer.component';
import { UpdateDialogComponent } from './shared/components/update-dialog/update-dialog.component';
import { PwaUpdateService } from './core/services/pwa-update.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HeaderComponent, FooterComponent, UpdateDialogComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnDestroy {
  private pwaUpdate = inject(PwaUpdateService);
  private updateSub: unknown;

  readonly updateAvailable = signal(false);

  constructor() {
    this.updateSub = this.pwaUpdate.updateAvailable$.subscribe((available) =>
      this.updateAvailable.set(available)
    );
  }

  ngOnDestroy(): void {
    this.updateSub = null;
  }

  applyUpdate(): void {
    this.pwaUpdate.activateUpdate();
  }
}