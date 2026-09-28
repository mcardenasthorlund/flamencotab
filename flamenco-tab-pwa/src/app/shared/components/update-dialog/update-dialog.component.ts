import { Component, output } from '@angular/core';

@Component({
  selector: 'app-update-dialog',
  standalone: true,
  templateUrl: './update-dialog.component.html',
  styleUrl: './update-dialog.component.scss',
})
export class UpdateDialogComponent {
  readonly updated = output<void>();
}