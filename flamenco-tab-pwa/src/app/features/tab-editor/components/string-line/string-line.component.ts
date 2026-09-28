import { Component, input } from '@angular/core';

@Component({
  selector: 'app-string-line',
  standalone: true,
  templateUrl: './string-line.component.html',
  styleUrl: './string-line.component.scss',
})
export class StringLineComponent {
  readonly stringNumber = input(1);
  readonly label = input('');
}