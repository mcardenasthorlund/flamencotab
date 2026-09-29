import { Injectable, inject, OnDestroy } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { BehaviorSubject, filter } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PwaUpdateService implements OnDestroy {
  private updateAvailableSubject = new BehaviorSubject<boolean>(false);
  readonly updateAvailable$ = this.updateAvailableSubject.asObservable();

  private swUpdate = inject(SwUpdate, { optional: true }) ?? null;
  private checkTimer?: ReturnType<typeof setInterval>;

  constructor() {
    if (!this.swUpdate) return;

    // Descarga automática en segundo plano y aviso al quedar lista la nueva versión.
    this.swUpdate.versionUpdates
      .pipe(
        filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY')
      )
      .subscribe(() => {
        this.updateAvailableSubject.next(true);
      });

    // Comprobar actualizaciones en internet al arrancar y periódicamente.
    this.checkForUpdate();
    this.checkTimer = setInterval(() => this.checkForUpdate(), 30000);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  ngOnDestroy(): void {
    if (this.checkTimer) clearInterval(this.checkTimer);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private onVisibility = (): void => {
    if (document.visibilityState === 'visible') this.checkForUpdate();
  };

  checkForUpdate(): void {
    if (!this.swUpdate || !this.swUpdate.isEnabled) return;
    this.swUpdate.checkForUpdate().catch(() => undefined);
  }

  activateUpdate(): void {
    if (!this.swUpdate) return;
    this.swUpdate.activateUpdate().then(() => document.location.reload());
  }
}