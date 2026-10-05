import { Component } from '@angular/core';
import { ORNAMENT_META } from '../../../../core/constants/ornament.constant';
import { OrnamentType } from '../../../../core/models/ornament.model';

interface OrnamentHelp {
  type: OrnamentType;
  symbol: string;
  label: string;
  description: string;
}

interface ShortcutHelp {
  keys: string;
  action: string;
}

interface HelpSectionLink {
  id: string;
  label: string;
}

const ORNAMENT_DESCRIPTIONS: Record<OrnamentType, string> = {
  bar_line: 'Línea vertical que separa compases.',
  double_bar_line: 'Doble línea: cierre de sección o frase.',
  repeat_start: 'Inicio de un pasaje que se repite.',
  repeat_end: 'Fin de un pasaje que se repite.',
  slur_start: 'Inicio de una ligadura (se une con su fin).',
  slur_end: 'Fin de una ligadura.',
  tremolo: 'Repite la nota cuatro veces en una cuerda.',
  rasgueo: 'Rasgueo en abanico.',
  arrow_up: 'Dirección de rasgueo hacia arriba.',
  arrow_down: 'Dirección de rasgueo hacia abajo.',
};

@Component({
  selector: 'app-help-page',
  standalone: true,
  templateUrl: './help-page.component.html',
  styleUrl: './help-page.component.scss',
})
export class HelpPageComponent {
  readonly ornaments: OrnamentHelp[] = Object.values(ORNAMENT_META).map((meta) => ({
    type: meta.type,
    symbol: meta.symbol,
    label: meta.label,
    description: ORNAMENT_DESCRIPTIONS[meta.type],
  }));

  readonly shortcuts: ShortcutHelp[] = [
    { keys: '0 – 9', action: 'Introduce ese traste en la celda seleccionada.' },
    { keys: 'X', action: 'Marca la cuerda como no tocada (X).' },
    { keys: '← / →', action: 'Mueve la selección entre columnas.' },
    { keys: '↑ / ↓', action: 'Mueve la selección entre cuerdas.' },
    { keys: 'Mayús + ↑', action: 'Sube un traste la nota seleccionada.' },
    { keys: 'Mayús + ↓', action: 'Baja un traste la nota seleccionada.' },
    { keys: 'Mayús + T', action: 'Activa o desactiva el trémolo de la nota.' },
  ];

  readonly sections: HelpSectionLink[] = [
    { id: 'primeros-pasos', label: 'Primeros pasos' },
    { id: 'editor', label: 'El editor' },
    { id: 'notas', label: 'Introducir notas' },
    { id: 'ornamentos', label: 'Ornamentos' },
    { id: 'acordes', label: 'Acordes' },
    { id: 'exportar', label: 'Exportar e imprimir' },
    { id: 'panel-notas', label: 'Panel de notas' },
    { id: 'datos', label: 'Instalación y datos' },
    { id: 'atajos', label: 'Atajos de teclado' },
    { id: 'consejos', label: 'Consejos' },
  ];
}
