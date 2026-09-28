import { Injectable, inject } from '@angular/core';
import { SwUpdate } from '@angular/service-worker';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private updateAvailableSubject = new BehaviorSubject<boolean>(false);
  readonly updateAvailable$ = this.updateAvailableSubject.asObservable();

  private swUpdate = inject(SwUpdate, { optional: true }) ?? null;

  constructor() {
    if (!this.swUpdate || !this.swUpdate.isEnabled) return;
    this.swUpdate.versionUpdates.subscribe((event) => {
      if (event.type === 'VERSION_READY') {
        this.updateAvailableSubject.next(true);
      }
    });
  }

  activateUpdate(): void {
    if (!this.swUpdate) return;
    this.swUpdate.activateUpdate().then(() => document.location.reload());
  }
}