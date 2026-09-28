import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  readonly title = input('');
  readonly message = input('');
  readonly confirmText = input('Confirmar');
  readonly cancelText = input('Cancelar');
  readonly confirmed = output<void>();
  readonly dismissed = output<void>();
}