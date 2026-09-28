import { Component, input } from '@angular/core';
import { Tablature, TabBlock, TabColumn, NoteEntry, LineSet } from '../../../../core/models/tab.model';
import { Ornament } from '../../../../core/models/ornament.model';
import { STRING_NUMBERS } from '../../../../core/constants/guitar.constant';
import { ORNAMENT_META, isLineOrnament } from '../../../../core/constants/ornament.constant';
import { resolveNotes, isColumnTremolo, tremoloDisplay } from '../../../../shared/utils/tab-render.util';

@Component({
  selector: 'app-print-sheet',
  standalone: true,
  templateUrl: './print-sheet.component.html',
  styleUrl: './print-sheet.component.scss',
})
export class PrintSheetComponent {
  readonly tab = input.required<Tablature>();
  readonly landscape = input(false);
  readonly showTitle = input(true);
  readonly showMeta = input(true);
  readonly author = input('');

  readonly stringNumbers = STRING_NUMBERS;

  blockLabel(block: TabBlock, index: number): string {
    return block.title?.trim() ? block.title : `Bloque ${index + 1}`;
  }

  notesFor(column: TabColumn): NoteEntry[] {
    return resolveNotes(column);
  }

  noteText(note: NoteEntry, column: TabColumn, positionIndex: number): string {
    return tremoloDisplay(
      note.fret,
      isColumnTremolo(column, positionIndex, note.stringNumber),
      note.tremoloFrets
    );
  }

  lineOrnaments(column: TabColumn, positionIndex: number): Ornament[] {
    return column.ornaments.filter(
      (o) => o.positionIndex === positionIndex && isLineOrnament(o.type)
    );
  }

  columnGrow(column: TabColumn): number {
    const count = column.ornaments.filter((o) => isLineOrnament(o.type)).length;
    return Math.max(1, count);
  }

  textSymbols(column: TabColumn, positionIndex: number): string[] {
    return column.ornaments
      .filter(
        (o) =>
          o.positionIndex === positionIndex &&
          !isLineOrnament(o.type) &&
          o.type !== 'tremolo'
      )
      .map((o: Ornament) => ORNAMENT_META[o.type].symbol);
  }

  hasLabel(set: LineSet): boolean {
    return set.columns.some((c) => !!c.label);
  }

  paloLine(): string {
    const palo = this.tab().palo;
    const tonalidad = this.tab().keySignature;
    return [palo, tonalidad].filter(Boolean).join(' — ');
  }
}