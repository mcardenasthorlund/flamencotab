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
import { TabBlock, TabColumn, NoteEntry, LineSet } from '../../../../core/models/tab.model';
import { Ornament, OrnamentType } from '../../../../core/models/ornament.model';
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
  blockIndex: number;
  lineSetIndex: number;
  x: number;
  y: number;
}

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

  readonly cellSelect = output<CellSelection>();
  readonly cellLongPress = output<CellLongPressPayload>();
  readonly ornamentLineClick = output<OrnamentLinePayload>();
  readonly slurSelect = output<SlurSelectPayload>();
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
  }

  private scheduleMeasure(): void {
    if (this.measureQueued) return;
    this.measureQueued = true;
    requestAnimationFrame(() => {
      this.measureQueued = false;
      this.measureSlurs();
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
      '.fret-cell'
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
        o.type !== 'slur_end'
    );
  }

  isTremolo(column: TabColumn, positionIndex: number, stringNumber: number): boolean {
    return isColumnTremolo(column, positionIndex, stringNumber);
  }

  columnGrow(column: TabColumn): number {
    return Math.max(1, this.lineOrnamentCount(column));
  }

  private lineOrnamentCount(column: TabColumn): number {
    return column.ornaments.filter((o) => this.isLineOrnament(o.type)).length;
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

  onCellClick(
    blockIndex: number,
    lineSetIndex: number,
    columnIndex: number,
    stringNumber: number
  ): void {
    this.cellSelect.emit({ blockIndex, lineSetIndex, columnIndex, stringNumber });
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