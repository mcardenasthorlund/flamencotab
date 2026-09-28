import {
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
} from '@angular/core';

export interface LongPressEvent {
  x: number;
  y: number;
  target: Element;
}

@Directive({
  selector: '[appTouchGestures]',
  standalone: true,
})
export class TouchGesturesDirective implements OnDestroy {
  @Input() longPressDuration = 500;
  @Input() swipeThreshold = 40;

  @Output() longPress = new EventEmitter<LongPressEvent>();
  @Output() swipeLeft = new EventEmitter<void>();
  @Output() swipeRight = new EventEmitter<void>();

  private startX = 0;
  private startY = 0;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressTriggered = false;

  constructor(private el: ElementRef) {
    this.el.nativeElement.addEventListener('touchstart', this.onStart);
    this.el.nativeElement.addEventListener('touchmove', this.onMove);
    this.el.nativeElement.addEventListener('touchend', this.onEnd);
    this.el.nativeElement.addEventListener('touchcancel', this.onEnd);
  }

  private onStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.longPressTriggered = false;
    this.clearTimer();
    this.longPressTimer = setTimeout(() => {
      this.longPressTriggered = true;
      this.longPress.emit({
        x: touch.clientX,
        y: touch.clientY,
        target: event.target as Element,
      });
    }, this.longPressDuration);
  };

  private onMove = (event: TouchEvent) => {
    const touch = event.touches[0];
    const dx = touch.clientX - this.startX;
    const dy = touch.clientY - this.startY;
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      this.clearTimer();
    }
  };

  private onEnd = (event: TouchEvent) => {
    this.clearTimer();
    if (this.longPressTriggered) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - this.startX;
    if (Math.abs(dx) > this.swipeThreshold) {
      if (dx < 0) this.swipeLeft.emit();
      else this.swipeRight.emit();
    }
  };

  private clearTimer(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.clearTimer();
    this.el.nativeElement.removeEventListener('touchstart', this.onStart);
    this.el.nativeElement.removeEventListener('touchmove', this.onMove);
    this.el.nativeElement.removeEventListener('touchend', this.onEnd);
    this.el.nativeElement.removeEventListener('touchcancel', this.onEnd);
  }
}