import { LineSet, TabBlock, TabColumn } from '../models/tab.model';
import { Ornament } from '../models/ornament.model';
import { buildClipboard, pasteClipboard } from './tab-clipboard.util';
import { DEFAULT_COLUMNS } from '../constants/tab.constant';
import { fillStrings } from '../../shared/utils/guitar.util';

let seq = 0;
const id = (prefix: string) => `${prefix}-${seq++}`;

function makeColumn(index: number): TabColumn {
  return {
    id: id('col'),
    index,
    notes: fillStrings((stringNumber) => ({ stringNumber, fret: '' })),
    ornaments: [],
  };
}

function makeLineSet(columnCount: number, order = 0): LineSet {
  return {
    id: id('ls'),
    order,
    columns: Array.from({ length: columnCount }, (_, i) => makeColumn(i)),
  };
}

function makeBlock(set: LineSet): TabBlock {
  return { id: id('block'), blockOrder: 0, lineSets: [set] };
}

function noteFret(col: TabColumn, stringNumber: number): string {
  return col.notes.find((n) => n.stringNumber === stringNumber)?.fret ?? '';
}

const orn = (type: Ornament['type'], stringIndex?: number): Ornament => ({
  id: id('orn'),
  type,
  positionIndex: 0,
  stringIndex,
});

describe('tab-clipboard util', () => {
  describe('buildClipboard', () => {
    it('copia notas, etiquetas y ornamentos del rango seleccionado', () => {
      const set = makeLineSet(4);
      set.columns[1].notes.find((n) => n.stringNumber === 1)!.fret = '5';
      set.columns[1].notes.find((n) => n.stringNumber === 2)!.fret = '7';
      set.columns[1].label = 'LA';
      set.columns[1].ornaments.push(orn('bar_line', 1));
      set.columns[2].notes.find((n) => n.stringNumber === 1)!.fret = '9';

      const clip = buildClipboard(set, {
        blockIndex: 0,
        lineSetIndex: 0,
        startColumn: 1,
        endColumn: 2,
        startString: 1,
        endString: 6,
      });

      expect(clip.width).toBe(2);
      expect(clip.height).toBe(6);
      expect(clip.startString).toBe(1);
      expect(clip.columns[0].label).toBe('LA');
      expect(clip.columns[0].notes.find((n) => n.stringNumber === 1)?.fret).toBe('5');
      expect(clip.columns[0].notes.find((n) => n.stringNumber === 2)?.fret).toBe('7');
      expect(clip.columns[0].ornaments.length).toBe(1);
      expect(clip.columns[1].notes.find((n) => n.stringNumber === 1)?.fret).toBe('9');
    });

    it('descarta ornamentos de cuerda fuera del rango pero conserva los de línea', () => {
      const set = makeLineSet(1);
      set.columns[0].ornaments.push(orn('bar_line', 6));
      set.columns[0].ornaments.push(orn('tremolo', 6));
      set.columns[0].ornaments.push(orn('tremolo', 1));

      const clip = buildClipboard(set, {
        blockIndex: 0,
        lineSetIndex: 0,
        startColumn: 0,
        endColumn: 0,
        startString: 1,
        endString: 2,
      });

      const types = clip.columns[0].ornaments.map((o) => `${o.type}:${o.stringIndex}`);
      expect(types).toContain('bar_line:6');
      expect(types).toContain('tremolo:1');
      expect(types).not.toContain('tremolo:6');
    });
  });

  describe('pasteClipboard', () => {
    it('inserta y desplaza a la derecha lo existente', () => {
      const set = makeLineSet(4);
      set.columns[0].notes.find((n) => n.stringNumber === 1)!.fret = 'A';
      set.columns[1].notes.find((n) => n.stringNumber === 1)!.fret = 'B';
      set.columns[2].notes.find((n) => n.stringNumber === 1)!.fret = 'C';
      const block = makeBlock(set);

      const clip = buildClipboard(set, {
        blockIndex: 0,
        lineSetIndex: 0,
        startColumn: 0,
        endColumn: 0,
        startString: 1,
        endString: 6,
      });
      clip.columns[0].notes.find((n) => n.stringNumber === 1)!.fret = 'X';

      pasteClipboard(
        [block],
        { blockIndex: 0, lineSetIndex: 0, columnIndex: 1, stringNumber: 1 },
        clip,
        makeColumn,
        (order) => makeLineSet(DEFAULT_COLUMNS, order)
      );

      // Capacidad original = 4; la cola desplazada (C) va a una nueva tanda.
      expect(block.lineSets.length).toBe(2);
      expect(noteFret(block.lineSets[0].columns[0], 1)).toBe('A');
      expect(noteFret(block.lineSets[0].columns[1], 1)).toBe('X');
      expect(noteFret(block.lineSets[0].columns[2], 1)).toBe('B');
      expect(noteFret(block.lineSets[0].columns[3], 1)).toBe('C');
    });

    it('crea tantas tandas nuevas como haga falta con ancho por defecto', () => {
      const set = makeLineSet(3);
      const block = makeBlock(set);

      const clip = buildClipboard(set, {
        blockIndex: 0,
        lineSetIndex: 0,
        startColumn: 0,
        endColumn: 2,
        startString: 1,
        endString: 6,
      });
      // Amplía el portapapeles a 40 columnas para forzar dos tandas nuevas.
      while (clip.columns.length < 40) {
        clip.columns.push({ notes: [], ornaments: [] });
      }
      clip.width = clip.columns.length;

      pasteClipboard(
        [block],
        { blockIndex: 0, lineSetIndex: 0, columnIndex: 0, stringNumber: 1 },
        clip,
        makeColumn,
        (order) => makeLineSet(DEFAULT_COLUMNS, order)
      );

      // Tanda 0: 3 columnas. Tandas nuevas: ancho por defecto (34) cada una.
      expect(block.lineSets.length).toBe(3);
      expect(block.lineSets[0].columns.length).toBe(3);
      expect(block.lineSets[1].columns.length).toBe(DEFAULT_COLUMNS);
      expect(block.lineSets[2].columns.length).toBe(DEFAULT_COLUMNS);
      expect(block.lineSets.map((s) => s.order)).toEqual([0, 1, 2]);
    });

    it('reindexa columnas y ornamentos tras pegar', () => {
      const set = makeLineSet(3);
      const block = makeBlock(set);
      set.columns[0].ornaments.push(orn('bar_line', 1));

      const clip = buildClipboard(set, {
        blockIndex: 0,
        lineSetIndex: 0,
        startColumn: 0,
        endColumn: 0,
        startString: 1,
        endString: 6,
      });

      pasteClipboard(
        [block],
        { blockIndex: 0, lineSetIndex: 0, columnIndex: 2, stringNumber: 1 },
        clip,
        makeColumn,
        (order) => makeLineSet(DEFAULT_COLUMNS, order)
      );

      block.lineSets[0].columns.forEach((col, i) => {
        expect(col.index).toBe(i);
        col.ornaments.forEach((o) => expect(o.positionIndex).toBe(i));
      });
    });

    it('desplaza el bloque para que quepa dentro de las 6 cuerdas', () => {
      const set = makeLineSet(2);
      const block = makeBlock(set);
      const clip = buildClipboard(set, {
        blockIndex: 0,
        lineSetIndex: 0,
        startColumn: 0,
        endColumn: 0,
        startString: 1,
        endString: 3,
      });
      clip.columns[0].notes = [
        { stringNumber: 1, fret: '1' },
        { stringNumber: 2, fret: '2' },
        { stringNumber: 3, fret: '3' },
      ];

      pasteClipboard(
        [block],
        { blockIndex: 0, lineSetIndex: 0, columnIndex: 0, stringNumber: 6 },
        clip,
        makeColumn,
        (order) => makeLineSet(DEFAULT_COLUMNS, order)
      );

      // topString se ajusta a 4 para que las 3 cuerdas entren (4,5,6).
      const col = block.lineSets[0].columns[0];
      expect(noteFret(col, 4)).toBe('1');
      expect(noteFret(col, 5)).toBe('2');
      expect(noteFret(col, 6)).toBe('3');
    });
  });
});
