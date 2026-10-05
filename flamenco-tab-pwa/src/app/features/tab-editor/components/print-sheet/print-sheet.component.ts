import {
  Component,
  effect,
  input,
  signal,
  ViewChildren,
  AfterViewInit,
  OnDestroy,
  type QueryList,
} from '@angular/core';
import { Tablature, TabBlock, TabColumn, NoteEntry, LineSet } from '../../../../core/models/tab.model';
import { Ornament } from '../../../../core/models/ornament.model';
import { STRING_NUMBERS } from '../../../../core/constants/guitar.constant';
import { ORNAMENT_META, isLineOrnament } from '../../../../core/constants/ornament.constant';
import { resolveNotes, isColumnTremolo, tremoloDisplay } from '../../../../shared/utils/tab-render.util';
import { GridRefDirective, CellRefDirective } from '../../../../shared/directives/render-ref.directive';

interface SlurPair {
  id: string;
  startId: string;
  endId: string;
  stringNumber: number;
  endStringNumber: number;
  startColumn: number;
  endColumn: number;
}

interface SlurPath {
  id: string;
  startId: string;
  endId: string;
  gridKey: string;
  d: string;
}

const gridKey = (b: number, l: number) => `${b}-${l}`;

@Component({
  selector: 'app-print-sheet',
  standalone: true,
  imports: [GridRefDirective, CellRefDirective],
  templateUrl: './print-sheet.component.html',
  styleUrl: './print-sheet.component.scss',
})
export class PrintSheetComponent implements AfterViewInit, OnDestroy {
  readonly tab = input.required<Tablature>();
  readonly landscape = input(false);
  readonly showTitle = input(true);
  readonly showMeta = input(true);
  readonly author = input('');

  readonly stringNumbers = STRING_NUMBERS;

  @ViewChildren(GridRefDirective) private gridRefs!: QueryList<GridRefDirective>;
  @ViewChildren(CellRefDirective) private cellRefs!: QueryList<CellRefDirective>;

  readonly slurPaths = signal<SlurPath[]>([]);
  readonly gridSizes = signal<Record<string, { w: number; h: number }>>({});

  private measureQueued = false;

  constructor() {
    effect(() => {
      void this.tab();
      void this.landscape();
      this.scheduleMeasure();
    });
  }

  ngAfterViewInit(): void {
    this.scheduleMeasure();
  }

  ngOnDestroy(): void {}

  private scheduleMeasure(): void {
    if (this.measureQueued) return;
    this.measureQueued = true;
    requestAnimationFrame(() => {
      this.measureQueued = false;
      this.applyOrnamentAreas();
      this.measureSlurs();
    });
  }

  /**
   * Reserva en cada columna el ancho real de su grupo de ornamentos (más una
   * separación fija) para que el borde derecho de la columna se desplace con
   * ellos sin pisar la siguiente, manteniendo la nota anclada a su slot.
   */
  private applyOrnamentAreas(): void {
    const trailing = 5;
    this.gridRefs.forEach((grid) => {
      const gctx = grid.context();
      if (!gctx) return;
      const tabEl = grid.element.nativeElement as HTMLElement;
      const gutter = tabEl.querySelector('.gutter') as HTMLElement | null;
      const cols = Array.from(tabEl.children).filter(
        (el): el is HTMLElement => el.classList.contains('column')
      );
      const n = cols.length;
      if (!n) return;
      const available = tabEl.clientWidth - (gutter?.offsetWidth ?? 0);
      const base = available / n;
      const wrap = tabEl.closest('.tab-wrap');
      const labelCells = wrap
        ? (Array.from(
            wrap.querySelectorAll('.tab-labels > .label-cell')
          ) as HTMLElement[])
        : [];
      const areas = cols.map((col) => {
        const row = col.querySelector('.ornaments') as HTMLElement | null;
        const rowWidth = row ? row.offsetWidth : 0;
        return Math.max(0, Math.round(rowWidth + trailing - base / 2));
      });
      cols.forEach((col, i) => {
        const area = areas[i];
        col.style.flexBasis = `${area}px`;
        col.style.setProperty('--orn-area', `${area}px`);
        const label = labelCells[i];
        if (label) {
          label.style.flexBasis = `${area}px`;
          label.style.setProperty('--orn-area', `${area}px`);
        }
      });
    });
  }

  private measureSlurs(): void {
    const paths: SlurPath[] = [];
    const sizes: Record<string, { w: number; h: number }> = {};
    this.gridRefs.forEach((grid) => {
      const gctx = grid.context();
      if (!gctx) return;
      const key = gridKey(gctx.blockIndex, gctx.lineSetIndex);
      const gridEl = grid.element.nativeElement;
      const gridRect = gridEl.getBoundingClientRect();
      if (gridRect.width === 0 || gridRect.height === 0) return;
      sizes[key] = { w: gridRect.width, h: gridRect.height };
      const block = this.tab().blocks[gctx.blockIndex];
      const set = block?.lineSets[gctx.lineSetIndex];
      if (!set) return;
      for (const pair of this.slurPairs(set)) {
        const start = this.cellCenter(
          gctx.blockIndex,
          gctx.lineSetIndex,
          pair.startColumn,
          pair.stringNumber
        );
        const end = this.cellCenter(
          gctx.blockIndex,
          gctx.lineSetIndex,
          pair.endColumn,
          pair.endStringNumber
        );
        if (!start || !end) continue;
        const x1 = start.x - gridRect.left;
        const y1 = start.y - gridRect.top;
        const x2 = end.x - gridRect.left;
        const y2 = end.y - gridRect.top;
        const midX = (x1 + x2) / 2;
        const height = Math.max(14, Math.min(26, Math.abs(x2 - x1) * 0.26));
        const cy = Math.min(y1, y2) - height;
        paths.push({
          id: pair.id,
          startId: pair.startId,
          endId: pair.endId,
          gridKey: key,
          d: `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${midX.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`,
        });
      }
    });
    this.slurPaths.set(paths);
    this.gridSizes.set(sizes);
  }

  private slurPairs(set: LineSet): SlurPair[] {
    const sortByPos = (
      a: { columnIndex: number; stringNumber: number },
      b: { columnIndex: number; stringNumber: number }
    ) => a.columnIndex - b.columnIndex || a.stringNumber - b.stringNumber;

    const starts = set.columns
      .flatMap((c) =>
        c.ornaments
          .filter((o) => o.type === 'slur_start')
          .map((o) => ({
            id: o.id,
            stringNumber: o.stringIndex ?? 1,
            columnIndex: c.index,
          }))
      )
      .sort(sortByPos);
    const ends = set.columns
      .flatMap((c) =>
        c.ornaments
          .filter((o) => o.type === 'slur_end')
          .map((o) => ({
            id: o.id,
            stringNumber: o.stringIndex ?? 1,
            columnIndex: c.index,
          }))
      )
      .sort(sortByPos);

    const pairs: SlurPair[] = [];
    const unmatched: typeof starts = [];
    let si = 0;

    for (const end of ends) {
      while (si < starts.length && starts[si].columnIndex < end.columnIndex) {
        unmatched.push(starts[si]);
        si++;
      }
      if (!unmatched.length) continue;
      const sameString = [...unmatched]
        .filter((s) => s.stringNumber === end.stringNumber)
        .pop();
      const chosen = sameString ?? unmatched[unmatched.length - 1];
      unmatched.splice(unmatched.indexOf(chosen), 1);
      pairs.push({
        id: `${chosen.id}-${end.id}`,
        startId: chosen.id,
        endId: end.id,
        stringNumber: chosen.stringNumber,
        endStringNumber: end.stringNumber,
        startColumn: chosen.columnIndex,
        endColumn: end.columnIndex,
      });
    }
    return pairs;
  }

  private cellCenter(
    blockIndex: number,
    lineSetIndex: number,
    columnIndex: number,
    stringNumber: number
  ): { x: number; y: number } | null {
    const cell = this.cellRefs
      .toArray()
      .find((c) => {
        const ctx = c.context();
        return (
          !!ctx &&
          ctx.blockIndex === blockIndex &&
          ctx.lineSetIndex === lineSetIndex &&
          ctx.columnIndex === columnIndex &&
          ctx.stringNumber === stringNumber
        );
      });
    if (!cell) return null;
    const inner = cell.element.nativeElement.querySelector(
      '.cell-num'
    ) as HTMLElement | null;
    const target = inner ?? cell.element.nativeElement;
    const r = target.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  gridSize(blockIndex: number, lineSetIndex: number): { w: number; h: number } {
    return this.gridSizes()[gridKey(blockIndex, lineSetIndex)] ?? { w: 1, h: 1 };
  }

  slurPathsFor(blockIndex: number, lineSetIndex: number): SlurPath[] {
    const key = gridKey(blockIndex, lineSetIndex);
    return this.slurPaths().filter((p) => p.gridKey === key);
  }

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

  textSymbols(column: TabColumn, positionIndex: number): string[] {
    return column.ornaments
      .filter(
        (o) =>
          o.positionIndex === positionIndex &&
          !isLineOrnament(o.type) &&
          o.type !== 'tremolo' &&
          o.type !== 'slur_start' &&
          o.type !== 'slur_end'
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