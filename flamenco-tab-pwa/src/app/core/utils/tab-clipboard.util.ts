import {
  LineSet,
  TabBlock,
  TabColumn,
  SelectionRange,
  TabClipboard,
  ClipboardColumn,
  ClipboardNote,
} from '../models/tab.model';
import { Ornament } from '../models/ornament.model';
import { isLineOrnament } from '../constants/ornament.constant';
import { STRING_COUNT } from '../constants/guitar.constant';
import { newId } from '../../shared/utils/array.util';

export interface PasteTarget {
  blockIndex: number;
  lineSetIndex: number;
  columnIndex: number;
  stringNumber: number;
}

interface NormalizedRange {
  startColumn: number;
  endColumn: number;
  startString: number;
  endString: number;
}

function normalizeRange(range: SelectionRange): NormalizedRange {
  return {
    startColumn: Math.min(range.startColumn, range.endColumn),
    endColumn: Math.max(range.startColumn, range.endColumn),
    startString: Math.min(range.startString, range.endString),
    endString: Math.max(range.startString, range.endString),
  };
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/** Reasigna `index` de columnas y `positionIndex` de ornamentos a su posición real. */
function reindexColumns(set: LineSet): void {
  set.columns.forEach((col, i) => {
    col.index = i;
    col.ornaments.forEach((o) => (o.positionIndex = i));
  });
}

/**
 * Extrae el contenido de una selección rectangular: notas de las cuerdas del
 * rango, etiquetas de columna y ornamentos. Los ornamentos de línea se copian
 * siempre; los de cuerda solo si su cuerda cae dentro del rango.
 */
export function buildClipboard(
  set: LineSet,
  range: SelectionRange
): TabClipboard {
  const r = normalizeRange(range);
  const columns: ClipboardColumn[] = [];

  for (let c = r.startColumn; c <= r.endColumn; c++) {
    const col = set.columns[c];
    if (!col) {
      columns.push({ notes: [], ornaments: [] });
      continue;
    }
    const notes: ClipboardNote[] = [];
    for (let s = r.startString; s <= r.endString; s++) {
      const note = col.notes.find((n) => n.stringNumber === s);
      if (!note) continue;
      notes.push({
        stringNumber: s,
        fret: note.fret,
        tremoloFrets: note.tremoloFrets ? [...note.tremoloFrets] : undefined,
      });
    }
    const ornaments: Ornament[] = col.ornaments
      .filter(
        (o) =>
          isLineOrnament(o.type) ||
          o.stringIndex === undefined ||
          (o.stringIndex >= r.startString && o.stringIndex <= r.endString)
      )
      .map((o) => ({ ...o, id: newId('orn') }));

    columns.push({ notes, ornaments, label: col.label });
  }

  return {
    width: r.endColumn - r.startColumn + 1,
    height: r.endString - r.startString + 1,
    startString: r.startString,
    columns,
  };
}

/**
 * Pega el portapapeles en `target`, insertando columnas nuevas y desplazando a
 * la derecha lo existente ("hacer hueco"). La capacidad de la tanda destino es
 * su número actual de columnas: lo que se salga por la derecha se reordena en
 * nuevas tandas (con ancho por defecto) creadas justo después.
 *
 * `blocks` se muta (se espera un clon). Devuelve la región pegada dentro de la
 * tanda destino, o `null` si no se pudo pegar.
 */
export function pasteClipboard(
  blocks: TabBlock[],
  target: PasteTarget,
  clip: TabClipboard,
  createEmptyColumn: (index: number) => TabColumn,
  createEmptyLineSet: (order: number) => LineSet
): SelectionRange | null {
  const block = blocks[target.blockIndex];
  const set = block?.lineSets[target.lineSetIndex];
  if (!block || !set || clip.width <= 0) return null;

  const capacity = Math.max(1, set.columns.length);
  const startCol = clamp(target.columnIndex, 0, capacity - 1);
  const height = Math.min(clip.height, STRING_COUNT);
  const topString = clamp(target.stringNumber, 1, STRING_COUNT - height + 1);

  const newCols: TabColumn[] = [];
  for (let i = 0; i < clip.width; i++) {
    const col = createEmptyColumn(startCol + i);
    const src = clip.columns[i];
    if (src) {
      for (const n of src.notes) {
        const targetString = topString + (n.stringNumber - clip.startString);
        if (targetString < 1 || targetString > STRING_COUNT) continue;
        const note = col.notes.find((x) => x.stringNumber === targetString);
        if (!note) continue;
        note.fret = n.fret;
        if (n.tremoloFrets) note.tremoloFrets = [...n.tremoloFrets];
      }
      col.label = src.label;
      col.ornaments = src.ornaments.map((o) => ({
        ...o,
        id: newId('orn'),
        positionIndex: startCol + i,
        stringIndex:
          o.stringIndex !== undefined && !isLineOrnament(o.type)
            ? clamp(
                topString + (o.stringIndex - clip.startString),
                1,
                STRING_COUNT
              )
            : o.stringIndex,
      }));
    }
    newCols.push(col);
  }

  set.columns.splice(startCol, 0, ...newCols);
  reindexColumns(set);

  // Reflujo: la tanda destino conserva su número original de columnas; lo que
  // desborda se traslada a nuevas tandas insertadas justo después.
  const overflow = set.columns.splice(capacity);
  if (overflow.length) {
    reindexColumns(set);
    let pending = overflow;
    let insertAt = target.lineSetIndex + 1;
    while (pending.length) {
      const newSet = createEmptyLineSet(insertAt);
      const take = pending.splice(0, newSet.columns.length);
      take.forEach((col, i) => (newSet.columns[i] = col));
      reindexColumns(newSet);
      block.lineSets.splice(insertAt, 0, newSet);
      insertAt++;
    }
    block.lineSets.forEach((s, i) => (s.order = i));
  }

  return {
    blockIndex: target.blockIndex,
    lineSetIndex: target.lineSetIndex,
    startColumn: startCol,
    endColumn: Math.min(startCol + clip.width - 1, capacity - 1),
    startString: topString,
    endString: Math.min(topString + height - 1, STRING_COUNT),
  };
}
