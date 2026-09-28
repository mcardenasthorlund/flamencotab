import { Component, input, output } from '@angular/core';
import { Chord } from '../../../../core/models/chord.model';
import { fillStrings } from '../../../../shared/utils/guitar.util';

@Component({
  selector: 'app-chord-card',
  standalone: true,
  templateUrl: './chord-card.component.html',
  styleUrl: './chord-card.component.scss',
})
export class ChordCardComponent {
  readonly chord = input.required<Chord>();
  readonly deleteRequested = output<void>();

  positionsFor(): Array<{ stringNumber: number; fret: string }> {
    return fillStrings((n) => {
      const pos = this.chord().positions.find((p) => p.stringNumber === n);
      return { stringNumber: n, fret: pos ? String(pos.fret) : '-' };
    });
  }
}