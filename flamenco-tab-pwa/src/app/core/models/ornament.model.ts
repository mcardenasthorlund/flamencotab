export type OrnamentType =
  | 'bar_line'
  | 'double_bar_line'
  | 'repeat_start'
  | 'repeat_end'
  | 'slur_start'
  | 'slur_end'
  | 'rasgueo'
  | 'arrow_up'
  | 'arrow_down'
  | 'tremolo';

export interface Ornament {
  id: string;
  type: OrnamentType;
  positionIndex: number;
  stringIndex?: number;
}