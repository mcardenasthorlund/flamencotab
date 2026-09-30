import { Component, output } from '@angular/core';
import { OrnamentType } from '../../../../core/models/ornament.model';
import { ORNAMENT_BUTTONS } from '../../../../core/constants/ornament.constant';

@Component({
  selector: 'app-ornament-toolbar',
  standalone: true,
  templateUrl: './ornament-toolbar.component.html',
  styleUrl: './ornament-toolbar.component.scss',
})
export class OrnamentToolbarComponent {
  readonly buttons = ORNAMENT_BUTTONS;
  readonly ornamentSelected = output<OrnamentType>();
  readonly chordPicker = output<void>();
}