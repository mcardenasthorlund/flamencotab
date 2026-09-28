import { OrnamentType } from '../models/ornament.model';

export type OrnamentGroup = 'bar' | 'slur' | 'tech' | 'direction';

export interface OrnamentMeta {
  type: OrnamentType;
  symbol: string;
  label: string;
  group: OrnamentGroup;
}

export const ORNAMENT_META: Record<OrnamentType, OrnamentMeta> = {
  bar_line: { type: 'bar_line', symbol: '|', label: 'Compás', group: 'bar' },
  double_bar_line: { type: 'double_bar_line', symbol: '||', label: 'Doble compás', group: 'bar' },
  repeat_start: { type: 'repeat_start', symbol: '𝄆', label: 'Repetición inicio', group: 'bar' },
  repeat_end: { type: 'repeat_end', symbol: '𝄇', label: 'Repetición fin', group: 'bar' },
  slur_start: { type: 'slur_start', symbol: '⌒', label: 'Ligadura inicio', group: 'slur' },
  slur_end: { type: 'slur_end', symbol: '⌒', label: 'Ligadura fin', group: 'slur' },
  tremolo: { type: 'tremolo', symbol: 'T', label: 'Trémolo', group: 'tech' },
  rasgueo: { type: 'rasgueo', symbol: '↥', label: 'Rasgueo', group: 'direction' },
  arrow_up: { type: 'arrow_up', symbol: '↑', label: 'Arriba', group: 'direction' },
  arrow_down: { type: 'arrow_down', symbol: '↓', label: 'Abajo', group: 'direction' },
};

export const ORNAMENT_BUTTONS: OrnamentMeta[] = Object.values(ORNAMENT_META);

export const QUICK_ORNAMENTS: OrnamentMeta[] = ORNAMENT_BUTTONS.filter(
  (o) => o.type !== 'slur_start' && o.type !== 'slur_end'
);

export const LINE_ORNAMENTS: ReadonlySet<OrnamentType> = new Set<OrnamentType>([
  'bar_line',
  'double_bar_line',
  'repeat_start',
  'repeat_end',
  'rasgueo',
  'arrow_up',
  'arrow_down',
]);

export function isLineOrnament(type: OrnamentType): boolean {
  return LINE_ORNAMENTS.has(type);
}