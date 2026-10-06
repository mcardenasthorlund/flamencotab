import { Injectable, inject } from '@angular/core';
import { SyncService } from '../sync/sync.service';
import { TabStorageService } from './tab-storage.service';
import { ChordLibraryService } from './chord-library.service';

/**
 * Adaptador de FlamencoTab para el módulo genérico de sincronización.
 *
 * Fuerza la instanciación de los servicios de datos (que registran sus
 * colecciones `tabs` y `chords`) y lanza la sincronización inicial si el
 * usuario la tiene activada.
 */
@Injectable({ providedIn: 'root' })
export class SyncCoordinator {
  private readonly sync = inject(SyncService);
  private readonly tabs = inject(TabStorageService);
  private readonly chords = inject(ChordLibraryService);

  start(): void {
    // Referenciar los servicios garantiza que registren sus colecciones.
    this.tabs.getAllTabs();
    this.chords.getChords();

    if (this.sync.enabled() && this.sync.session()) {
      void this.sync.syncNow();
    }
  }
}
