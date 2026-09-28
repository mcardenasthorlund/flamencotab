import { TabColumn, NoteEntry } from '../../core/models/tab.model';
import { fillStrings } from './guitar.util';

export function resolveNotes(column: TabColumn): NoteEntry[] {
  return fillStrings(
    (n) =>
      column.notes.find((note) => note.stringNumber === n) ?? {
        stringNumber: n,
        fret: '',
      }
  );
}

export function isColumnTremolo(
  column: TabColumn,
  positionIndex: number,
  stringNumber: number
): boolean {
  return column.ornaments.some(
    (o) =>
      o.type === 'tremolo' &&
      o.positionIndex === positionIndex &&
      o.stringIndex === stringNumber
  );
}

export function tremoloDisplay(fret: string, tremolo: boolean, frets?: string[]): string {
  if (tremolo) {
    if (frets && frets.length === 4) return frets.map((f) => f || '').join(' ');
    if (fret) return `${fret} ${fret} ${fret} ${fret}`;
  }
  return fret || '';
}