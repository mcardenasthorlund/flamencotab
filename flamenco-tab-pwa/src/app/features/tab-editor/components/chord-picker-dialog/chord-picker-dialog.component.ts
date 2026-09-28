import { Component, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Chord } from '../../../../core/models/chord.model';

@Component({
  selector: 'app-chord-picker-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './chord-picker-dialog.component.html',
  styleUrl: './chord-picker-dialog.component.scss',
})
export class ChordPickerDialogComponent {
  readonly open = input(false);
  readonly chords = input<Chord[]>([]);
  readonly chordSelected = output<Chord>();
  readonly dismissed = output<void>();

  readonly query = signal('');

  filteredChords(): Chord[] {
    const q = this.query().trim().toLowerCase();
    if (!q) return this.chords();
    return this.chords().filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.rootNote.toLowerCase().includes(q) ||
        (c.palosRecomendados ?? []).some((p) =>
          p.toLowerCase().includes(q)
        )
    );
  }

  onBackdropClick(): void {
    this.dismissed.emit();
  }
}