import { Component, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Chord, SpanishNote } from '../../../../core/models/chord.model';
import { SPANISH_NOTES } from '../../../../core/constants/notes.constant';
import { STRING_NUMBERS } from '../../../../core/constants/guitar.constant';

@Component({
  selector: 'app-chord-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './chord-form.component.html',
  styleUrl: './chord-form.component.scss',
})
export class ChordFormComponent {
  readonly saved = output<Omit<Chord, 'id' | 'isCustom'>>();
  readonly cancelled = output<void>();

  readonly notes = SPANISH_NOTES;
  readonly stringNumbers = STRING_NUMBERS;

  readonly name = signal('');
  readonly rootNote = signal<SpanishNote>('LA');
  readonly palos = signal('');
  readonly positions = signal<Record<number, string>>({});

  onPositionChange(stringNumber: number, value: string): void {
    const next = { ...this.positions(), [stringNumber]: value };
    this.positions.set(next);
  }

  submit(): void {
    const positions = this.stringNumbers.map((n) => ({
      stringNumber: n,
      fret: this.toFret(this.positions()[n]),
    }));
    const palos = this.palos()
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    this.saved.emit({
      name: this.name(),
      rootNote: this.rootNote(),
      palosRecomendados: palos.length ? palos : undefined,
      positions,
    });
  }

  private toFret(value: string | undefined): number | 'X' {
    if (!value || value.trim() === '') return 0;
    const v = value.trim();
    if (v.toUpperCase() === 'X') return 'X';
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= 24 ? n : 0;
  }
}