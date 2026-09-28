import { Component, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface PrintOptions {
  landscape: boolean;
  showTitle: boolean;
  showMeta: boolean;
  author: string;
}

@Component({
  selector: 'app-print-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './print-dialog.component.html',
  styleUrl: './print-dialog.component.scss',
})
export class PrintDialogComponent {
  readonly print = output<PrintOptions>();
  readonly dismissed = output<void>();

  readonly landscape = signal(false);
  readonly showTitle = signal(true);
  readonly showMeta = signal(true);
  readonly author = signal('');

  confirm(): void {
    this.print.emit({
      landscape: this.landscape(),
      showTitle: this.showTitle(),
      showMeta: this.showMeta(),
      author: this.author().trim(),
    });
  }
}