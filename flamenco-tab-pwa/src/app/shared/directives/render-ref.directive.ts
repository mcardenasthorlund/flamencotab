import { Directive, ElementRef, input } from '@angular/core';

export interface GridRefContext {
  blockIndex: number;
  lineSetIndex: number;
}

export interface CellRefContext extends GridRefContext {
  columnIndex: number;
  stringNumber: number;
}

@Directive({
  selector: '[appGridRef]',
  standalone: true,
})
export class GridRefDirective {
  readonly context = input<GridRefContext>();
  constructor(public readonly element: ElementRef<HTMLElement>) {}
}

@Directive({
  selector: '[appCellRef]',
  standalone: true,
})
export class CellRefDirective {
  readonly context = input<CellRefContext>();
  constructor(public readonly element: ElementRef<HTMLElement>) {}
}