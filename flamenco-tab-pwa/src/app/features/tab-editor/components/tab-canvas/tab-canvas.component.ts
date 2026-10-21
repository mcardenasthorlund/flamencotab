import {
  Component,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  ViewChildren,
  AfterViewInit,
  OnDestroy,
  type QueryList,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TabBlock, TabColumn, NoteEntry, LineSet, SelectionRange } from '../../../../core/models/tab.model';
import { Ornament, OrnamentType, OrnamentPairKind } from '../../../../core/models/ornament.model';
import { ORNAMENT_META, isLineOrnament as isLineOrnamentType } from '../../../../core/constants/ornament.constant';
import { STRING_COUNT, STRING_NUMBERS } from '../../../../core/constants/guitar.constant';
import { resolveNotes, isColumnTremolo } from '../../../../shared/utils/tab-render.util';
import { FretPositionComponent } from '../fret-position/fret-position.component';
import { TouchGesturesDirective } from '../../../../shared/directives/touch-gestures.directive';
import {
  GridRefDirective,
  CellRefDirective,
  CellRefContext,
} from '../../../../shared/directives/render-ref.directive';

export interface CellSelection {
  stringNumber: number;
  columnIndex: number;
  lineSetIndex: number;
  blockIndex: number;
}

export interface CellLongPressPayload extends CellSelection {
  x: number;
  y: number;
}

export interface OrnamentLinePayload {
  ornament: Ornament;
  blockIndex: number;
  lineSetIndex: number;
  columnIndex: number;
  x: number;
  y: number;
}

export interface SlurSelectPayload {
  id: string;
  startId: string;
  endId: string;
  kind: OrnamentPairKind;
  blockIndex: number;
  lineSetIndex: number;
  x: number;
  y: number;
}

export interface SelectionCommitPayload {
  range: SelectionRange;
  moved: boolean;
  x: number;
  y: number;
}

interface SlurPair {
  id: string;
  startId: string;
  endId: string;
  kind: OrnamentPairKind;
  stringNumber: number;
  endStringNumber: number;
  startColumn: number;
  endColumn: number;
}

interface SlurPath {
  id: string;
  startId: string;
  endId: string;
  kind: OrnamentPairKind;
  gridKey: string;
  d: string;
}

const gridKey = (b: number, l: number) => `${b}-${l}`;

/** Arco de ligadura entre dos notas. */
function slurPath(x1: number, y1: number, x2: number, y2: number): string {
  const midX = (x1 + x2) / 2;
  const height = Math.max(14, Math.min(26, Math.abs(x2 - x1) * 0.26));
  const cy = Math.min(y1, y2) - height;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${midX.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

/**
 * Línea recta de glisando. Se dibuja por encima de las notas y ligeramente
 * inclinada hacia arriba (nunca completamente horizontal), de modo que se
 * distingue del arco de la ligadura.
 */
function glisandoPath(x1: number, y1: number, x2: number, y2: number): string {
  const lift = 14;
  const tilt = Math.max(6, Math.min(14, Math.abs(x2 - x1) * 0.12));
  const baseY = Math.min(y1, y2) - lift;
  const leftX = Math.min(x1, x2);
  const rightX = Math.max(x1, x2);
  let leftY = baseY + tilt / 2;
  let rightY = baseY - tilt / 2;
  // Salvaguarda: si la línea queda por encima del lienzo (p. ej. en la cuerda
  // más aguda, sin espacio arriba), se desplaza hacia abajo manteniendo la
  // inclinación para que siempre se renderice.
  const margin = 2;
  const top = Math.min(leftY, rightY);
  if (top < margin) {
    const shift = margin - top;
    leftY += shift;
    rightY += shift;
  }
  return `M ${leftX.toFixed(1)} ${leftY.toFixed(1)} L ${rightX.toFixed(1)} ${rightY.toFixed(1)}`;
}

@Component({
  selector: 'app-tab-canvas',
  standalone: true,
  imports: [
    FretPositionComponent,
    TouchGesturesDirective,
    FormsModule,
    GridRefDirective,
    CellRefDirective,
  ],
  templateUrl: './tab-canvas.component.html',
  styleUrl: './tab-canvas.component.scss',
})
export class TabCanvasComponent implements AfterViewInit, OnDestroy {
  private host = inject(ElementRef<HTMLElement>);

  readonly blocks = input<TabBlock[]>([]);
  readonly selectedCell = input<CellSelection | null>(null);
  readonly selectedOrnamentId = input<string | null>(null);
  readonly selectedSlurId = input<string | null>(null);
  readonly selectionMode = input(false);
  readonly selectionRange = input<SelectionRange | null>(null);

  readonly cellLongPress = output<CellLongPressPayload>();
  readonly ornamentLineClick = output<OrnamentLinePayload>();
  readonly slurSelect = output<SlurSelectPayload>();
  readonly selectionChange = output<SelectionRange>();
  readonly selectionCommit = output<SelectionCommitPayload>();
  readonly blockAdd = output<void>();
  readonly blockDelete = output<number>();
  readonly blockDuplicate = output<number>();
  readonly blockMove = output<{ blockIndex: number; direction: -1 | 1 }>();
  readonly blockTitleChange = output<{ blockIndex: number; title: string }>();

  readonly lineSetAdd = output<number>();
  readonly lineSetDuplicate = output<{ blockIndex: number; lineSetIndex: number }>();
  readonly lineSetDelete = output<{ blockIndex: number; lineSetIndex: number }>();
  readonly lineSetMove = output<{
    blockIndex: number;
    lineSetIndex: number;
    direction: -1 | 1;
  }>();
  readonly columnAdd = output<{ blockIndex: number; lineSetIndex: number }>();
  readonly columnRemove = output<{ blockIndex: number; lineSetIndex: number }>();
  readonly columnInsertBefore = output<{
    blockIndex: number;
    lineSetIndex: number;
    columnIndex: number;
  }>();
  readonly columnInsertAfter = output<{
    blockIndex: number;
    lineSetIndex: number;
    columnIndex: number;
  }>();
  readonly columnDelete = output<{
    blockIndex: number;
    lineSetIndex: number;
    columnIndex: number;
  }>();
  readonly columnLabelChange = output<{
    blockIndex: number;
    lineSetIndex: number;
    columnIndex: number;
    label: string;
  }>();

  readonly stringCount = STRING_COUNT;
  readonly stringNumbers = STRING_NUMBERS;
  readonly ornamentSymbol = ORNAMENT_META;
  readonly isLineOrnament = isLineOrnamentType;

  @ViewChildren(GridRefDirective) private gridRefs!: QueryList<GridRefDirective>;
  @ViewChildren(CellRefDirective) private cellRefs!: QueryList<CellRefDirective>;

  readonly slurPaths = signal<SlurPath[]>([]);
  readonly gridSizes = signal<Record<string, { w: number; h: number }>>({});
  readonly collapsedBlocks = signal<Set<string>>(new Set());

  private resizeObserver: ResizeObserver | null = null;
  private measureQueued = false;

  private dragState: {
    blockIndex: number;
    lineSetIndex: number;
    anchorColumn: number;
    anchorString: number;
    lastRange: SelectionRange;
    moved: boolean;
    selecting: boolean;
  } | null = null;

  constructor() {
    effect(() => {
      void this.blocks();
      this.scheduleMeasure();
    });
  }

  ngAfterViewInit(): void {
    this.scheduleMeasure();
    this.resizeObserver = new ResizeObserver(() => this.scheduleMeasure());
    this.resizeObserver.observe(this.host.nativeElement);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.removeDragListeners();
  }

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
   * ellos sin pisar la siguiente. La nota queda anclada a su slot, así que el
   * espaciado de la izquierda no cambia. Se aplica de forma imperativa para no
   * depender de un ciclo extra de detección de cambios.
   */
  private applyOrnamentAreas(): void {
    const trailing = 8;
    this.gridRefs.forEach((grid) => {
      const gctx = grid.context();
      if (!gctx) return;
      const gridEl = grid.element.nativeElement as HTMLElement;
      const gutter = gridEl.querySelector('.string-gutter') as HTMLElement | null;
      const cols = Array.from(gridEl.children).filter(
        (el): el is HTMLElement => el.classList.contains('tab-column')
      );
      const n = cols.length;
      if (!n) return;
      const available = gridEl.clientWidth - (gutter?.offsetWidth ?? 0);
      const base = available / n;
      const lineSetEl = gridEl.closest('.line-set');
      const labelCells = lineSetEl
        ? (Array.from(
            lineSetEl.querySelectorAll('.label-row > .label-cell')
          ) as HTMLElement[])
        : [];
      const areas = cols.map((col) => {
        const row = col.querySelector('.ornament-line-row') as HTMLElement | null;
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
      const block = this.blocks()[gctx.blockIndex];
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
        const d =
          pair.kind === 'glisando'
            ? glisandoPath(x1, y1, x2, y2)
            : slurPath(x1, y1, x2, y2);
        paths.push({
          id: pair.id,
          startId: pair.startId,
          endId: pair.endId,
          kind: pair.kind,
          gridKey: key,
          d,
        });
      }
    });
    this.slurPaths.set(paths);
    this.gridSizes.set(sizes);
  }

  private slurPairs(set: LineSet): SlurPair[] {
    return [
      ...this.pairsFor(set, 'slur_start', 'slur_end', 'slur'),
      ...this.pairsFor(set, 'glisando_start', 'glisando_end', 'glisando'),
    ];
  }

  private pairsFor(
    set: LineSet,
    startType: OrnamentType,
    endType: OrnamentType,
    kind: OrnamentPairKind
  ): SlurPair[] {
    const sortByPos = (
      a: { columnIndex: number; stringNumber: number },
      b: { columnIndex: number; stringNumber: number }
    ) => a.columnIndex - b.columnIndex || a.stringNumber - b.stringNumber;

    const starts = set.columns
      .flatMap((c) =>
        c.ornaments
          .filter((o) => o.type === startType)
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
          .filter((o) => o.type === endType)
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
        kind,
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
      '.fret-value'
    ) as HTMLElement | null;
    const target = inner ?? cell.element.nativeElement;
    const r = target.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  gridSize(
    blockIndex: number,
    lineSetIndex: number
  ): { w: number; h: number } {
    return this.gridSizes()[gridKey(blockIndex, lineSetIndex)] ?? { w: 1, h: 1 };
  }

  slurPathsFor(blockIndex: number, lineSetIndex: number): SlurPath[] {
    const key = gridKey(blockIndex, lineSetIndex);
    return this.slurPaths().filter((p) => p.gridKey === key);
  }

  isSlurSelected(id: string): boolean {
    return this.selectedSlurId() === id;
  }

  onSlurClick(
    event: MouseEvent,
    blockIndex: number,
    lineSetIndex: number,
    path: SlurPath
  ): void {
    event.stopPropagation();
    this.slurSelect.emit({
      id: path.id,
      startId: path.startId,
      endId: path.endId,
      kind: path.kind,
      blockIndex,
      lineSetIndex,
      x: event.clientX,
      y: event.clientY,
    });
  }

  blockLabel(block: TabBlock, index: number): string {
    return block.title?.trim() ? block.title : `Bloque ${index + 1}`;
  }

  toggleCollapse(blockId: string): void {
    const set = new Set(this.collapsedBlocks());
    if (set.has(blockId)) set.delete(blockId);
    else set.add(blockId);
    this.collapsedBlocks.set(set);
  }

  isCollapsed(blockId: string): boolean {
    return this.collapsedBlocks().has(blockId);
  }

  onTitleChange(index: number, value: string): void {
    this.blockTitleChange.emit({ blockIndex: index, title: value });
  }

  notesFor(column: TabColumn): NoteEntry[] {
    return resolveNotes(column);
  }

  lineOrnaments(column: TabColumn, positionIndex: number): Ornament[] {
    return column.ornaments.filter(
      (o) => o.positionIndex === positionIndex && this.isLineOrnament(o.type)
    );
  }

  textOrnaments(column: TabColumn, positionIndex: number): Ornament[] {
    return column.ornaments.filter(
      (o) =>
        o.positionIndex === positionIndex &&
        !this.isLineOrnament(o.type) &&
        o.type !== 'tremolo' &&
        o.type !== 'slur_start' &&
        o.type !== 'slur_end' &&
        o.type !== 'glisando_start' &&
        o.type !== 'glisando_end'
    );
  }

  isTremolo(column: TabColumn, positionIndex: number, stringNumber: number): boolean {
    return isColumnTremolo(column, positionIndex, stringNumber);
  }

  isSelectedOrnament(id: string): boolean {
    return this.selectedOrnamentId() === id;
  }

  onOrnamentLineClick(
    event: MouseEvent,
    blockIndex: number,
    lineSetIndex: number,
    columnIndex: number,
    ornament: Ornament
  ): void {
    event.stopPropagation();
    this.ornamentLineClick.emit({
      ornament,
      blockIndex,
      lineSetIndex,
      columnIndex,
      x: event.clientX,
      y: event.clientY,
    });
  }

  isSelected(
    blockIndex: number,
    lineSetIndex: number,
    columnIndex: number,
    stringNumber: number
  ): boolean {
    const sel = this.selectedCell();
    return (
      !!sel &&
      sel.blockIndex === blockIndex &&
      sel.lineSetIndex === lineSetIndex &&
      sel.columnIndex === columnIndex &&
      sel.stringNumber === stringNumber
    );
  }

  isActiveLine(blockIndex: number, lineSetIndex: number): boolean {
    const sel = this.selectedCell();
    return (
      !!sel &&
      sel.blockIndex === blockIndex &&
      sel.lineSetIndex === lineSetIndex
    );
  }

  isInSelection(
    blockIndex: number,
    lineSetIndex: number,
    columnIndex: number,
    stringNumber: number
  ): boolean {
    const r = this.selectionRange();
    if (!r || r.blockIndex !== blockIndex || r.lineSetIndex !== lineSetIndex) {
      return false;
    }
    const c0 = Math.min(r.startColumn, r.endColumn);
    const c1 = Math.max(r.startColumn, r.endColumn);
    const s0 = Math.min(r.startString, r.endString);
    const s1 = Math.max(r.startString, r.endString);
    if (c0 === c1 && s0 === s1) return false;
    return (
      columnIndex >= c0 &&
      columnIndex <= c1 &&
      stringNumber >= s0 &&
      stringNumber <= s1
    );
  }

  onGridPointerDown(
    event: PointerEvent,
    blockIndex: number,
    lineSetIndex: number
  ): void {
    const target = event.target as HTMLElement | null;
    // Solo se inicia la selección sobre una celda de nota (no sobre la fila de
    // ornamentos ni las etiquetas).
    if (!target?.closest('.fret-cell')) return;
    const isMouse = event.pointerType === 'mouse';
    if (isMouse && event.button !== 0) return;
    // Con el dedo, el arrastre de selección requiere el modo activo para no
    // chocar con el scroll; un toque simple siempre selecciona la celda.
    const selecting = isMouse || this.selectionMode();

    const cell = this.cellAt(blockIndex, lineSetIndex, event.clientX, event.clientY);
    if (!cell) return;

    if (selecting) event.preventDefault();

    const range: SelectionRange = {
      blockIndex,
      lineSetIndex,
      startColumn: cell.columnIndex,
      endColumn: cell.columnIndex,
      startString: cell.stringNumber,
      endString: cell.stringNumber,
    };
    this.dragState = {
      blockIndex,
      lineSetIndex,
      anchorColumn: cell.columnIndex,
      anchorString: cell.stringNumber,
      lastRange: range,
      moved: false,
      selecting,
    };
    document.addEventListener('pointermove', this.onDocPointerMove);
    document.addEventListener('pointerup', this.onDocPointerUp);
    document.addEventListener('pointercancel', this.onDocPointerCancel);
  }

  private onDocPointerMove = (event: PointerEvent): void => {
    const d = this.dragState;
    if (!d) return;
    const cell = this.cellAt(
      d.blockIndex,
      d.lineSetIndex,
      event.clientX,
      event.clientY
    );
    if (!cell) return;
    const movedToOther =
      cell.columnIndex !== d.anchorColumn ||
      cell.stringNumber !== d.anchorString;
    if (!d.selecting) {
      // Dedo sin modo selección: un desplazamiento es scroll → se cancela.
      if (movedToOther) this.cancelDrag();
      return;
    }
    if (movedToOther) d.moved = true;
    const range: SelectionRange = {
      blockIndex: d.blockIndex,
      lineSetIndex: d.lineSetIndex,
      startColumn: Math.min(d.anchorColumn, cell.columnIndex),
      endColumn: Math.max(d.anchorColumn, cell.columnIndex),
      startString: Math.min(d.anchorString, cell.stringNumber),
      endString: Math.max(d.anchorString, cell.stringNumber),
    };
    d.lastRange = range;
    this.selectionChange.emit(range);
  };

  private onDocPointerUp = (event: PointerEvent): void => {
    const d = this.dragState;
    this.dragState = null;
    this.removeDragListeners();
    if (!d) return;
    this.selectionCommit.emit({
      range: d.lastRange,
      moved: d.moved,
      x: event.clientX,
      y: event.clientY,
    });
  };

  private onDocPointerCancel = (): void => {
    this.cancelDrag();
  };

  private cancelDrag(): void {
    this.dragState = null;
    this.removeDragListeners();
  }

  private removeDragListeners(): void {
    document.removeEventListener('pointermove', this.onDocPointerMove);
    document.removeEventListener('pointerup', this.onDocPointerUp);
    document.removeEventListener('pointercancel', this.onDocPointerCancel);
  }

  /** Celda del grid más cercana al punto; recorta al borde si el puntero sale. */
  private cellAt(
    blockIndex: number,
    lineSetIndex: number,
    x: number,
    y: number
  ): { columnIndex: number; stringNumber: number } | null {
    let best: { columnIndex: number; stringNumber: number } | null = null;
    let bestDist = Infinity;
    this.cellRefs.forEach((cell) => {
      const ctx = cell.context();
      if (
        !ctx ||
        ctx.blockIndex !== blockIndex ||
        ctx.lineSetIndex !== lineSetIndex
      ) {
        return;
      }
      const r = cell.element.nativeElement.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const inside = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
      const dist = inside ? -1 : (x - cx) ** 2 + (y - cy) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        best = { columnIndex: ctx.columnIndex, stringNumber: ctx.stringNumber };
      }
    });
    return best;
  }

  onColumnInsertBefore(
    blockIndex: number,
    lineSetIndex: number
  ): void {
    this.columnInsertBefore.emit({
      blockIndex,
      lineSetIndex,
      columnIndex: this.resolveColumnIndex(blockIndex, lineSetIndex),
    });
  }

  onColumnInsertAfter(
    blockIndex: number,
    lineSetIndex: number
  ): void {
    this.columnInsertAfter.emit({
      blockIndex,
      lineSetIndex,
      columnIndex: this.resolveColumnIndex(blockIndex, lineSetIndex),
    });
  }

  onColumnDelete(blockIndex: number, lineSetIndex: number): void {
    this.columnDelete.emit({
      blockIndex,
      lineSetIndex,
      columnIndex: this.resolveColumnIndex(blockIndex, lineSetIndex),
    });
  }

  private resolveColumnIndex(blockIndex: number, lineSetIndex: number): number {
    const set = this.blocks()[blockIndex]?.lineSets[lineSetIndex];
    if (!set || !set.columns.length) return 0;
    const sel = this.selectedCell();
    if (
      sel &&
      sel.blockIndex === blockIndex &&
      sel.lineSetIndex === lineSetIndex
    ) {
      return Math.min(Math.max(sel.columnIndex, 0), set.columns.length - 1);
    }
    return set.columns.length - 1;
  }

  onLabelChange(
    blockIndex: number,
    lineSetIndex: number,
    columnIndex: number,
    label: string
  ): void {
    this.columnLabelChange.emit({ blockIndex, lineSetIndex, columnIndex, label });
  }

  onCellLongPress(
    blockIndex: number,
    lineSetIndex: number,
    columnIndex: number,
    payload: { x: number; y: number; stringNumber: number }
  ): void {
    this.cellLongPress.emit({ ...payload, blockIndex, lineSetIndex, columnIndex });
  }
}