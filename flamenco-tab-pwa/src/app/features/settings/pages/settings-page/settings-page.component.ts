import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SyncService } from '../../../../core/sync/sync.service';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [FormsModule, ConfirmDialogComponent],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss',
})
export class SettingsPageComponent {
  private readonly sync = inject(SyncService);

  readonly status = this.sync.status;
  readonly session = this.sync.session;
  readonly lastSyncAt = this.sync.lastSyncAt;
  readonly error = this.sync.error;
  readonly pending = this.sync.pending;
  readonly busy = this.sync.busy;
  readonly appId = this.sync.appId;

  readonly mode = signal<'login' | 'register'>('login');
  readonly username = signal('');
  readonly password = signal('');
  readonly localError = signal<string | null>(null);
  readonly showDeleteConfirm = signal(false);

  readonly statusLabel = computed(() => {
    switch (this.status()) {
      case 'disabled':
        return 'Sincronización desactivada (solo local)';
      case 'signedOut':
        return 'Sin sesión iniciada';
      case 'idle':
        return 'Sincronizado';
      case 'syncing':
        return 'Sincronizando…';
      case 'error':
        return 'Error de sincronización';
      default:
        return 'Desconocido';
    }
  });

  readonly canSubmit = computed(
    () => this.username().trim().length >= 3 && this.password().length >= 8
  );

  onToggle(event: Event): void {
    this.sync.setEnabled((event.target as HTMLInputElement).checked);
    this.localError.set(null);
  }

  setMode(mode: 'login' | 'register'): void {
    this.mode.set(mode);
    this.localError.set(null);
  }

  async submit(): Promise<void> {
    this.localError.set(null);
    if (!this.canSubmit()) {
      this.localError.set(
        'El usuario debe tener al menos 3 caracteres y la contraseña 8 o más.'
      );
      return;
    }
    const username = this.username().trim();
    const password = this.password();
    if (this.mode() === 'register') {
      await this.sync.signUp(username, password);
    } else {
      await this.sync.signIn(username, password);
    }
    if (!this.sync.error()) {
      this.password.set('');
    }
  }

  async syncNow(): Promise<void> {
    await this.sync.syncNow();
  }

  async signOut(): Promise<void> {
    await this.sync.signOut();
    this.password.set('');
  }

  requestDelete(): void {
    this.showDeleteConfirm.set(true);
  }

  async confirmDelete(): Promise<void> {
    this.showDeleteConfirm.set(false);
    try {
      await this.sync.deleteAccount();
      this.password.set('');
    } catch {
      // El error se muestra desde `sync.error()`.
    }
  }
}
