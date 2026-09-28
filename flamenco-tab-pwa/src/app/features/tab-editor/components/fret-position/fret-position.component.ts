import { Component, input, output } from '@angular/core';
import { TouchGesturesDirective } from '../../../../shared/directives/touch-gestures.directive';
import type { LongPressEvent } from '../../../../shared/directives/touch-gestures.directive';
import { tremoloDisplay } from '../../../../shared/utils/tab-render.util';

@Component({
  selector: 'app-fret-position',
  standalone: true,
  imports: [TouchGesturesDirective],
  templateUrl: './fret-position.component.html',
  styleUrl: './fret-position.component.scss',
})
export class FretPositionComponent {
  readonly fret = input('');
  readonly tremolo = input(false);
  readonly tremoloFrets = input<string[] | undefined>(undefined);
  readonly selected = input(false);
  readonly stringNumber = input(0);
  readonly columnIndex = input(0);
  readonly cellClick = output<{ stringNumber: number; columnIndex: number }>();
  readonly cellLongPress = output<{
    x: number;
    y: number;
    stringNumber: number;
    columnIndex: number;
  }>();

  displayValue(): string {
    return tremoloDisplay(this.fret(), this.tremolo(), this.tremoloFrets());
  }

  onLongPress(event: LongPressEvent): void {
    this.cellLongPress.emit({
      x: event.x,
      y: event.y,
      stringNumber: this.stringNumber(),
      columnIndex: this.columnIndex(),
    });
  }
}