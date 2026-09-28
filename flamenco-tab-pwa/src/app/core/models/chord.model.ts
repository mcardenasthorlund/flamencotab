export type SpanishNote =
  | 'DO'
  | 'DO#'
  | 'RE'
  | 'RE#'
  | 'MI'
  | 'FA'
  | 'FA#'
  | 'SOL'
  | 'SOL#'
  | 'LA'
  | 'LA#'
  | 'SI';

export interface ChordPosition {
  stringNumber: number;
  fret: number | 'X';
}

export interface Chord {
  id: string;
  name: string;
  rootNote: SpanishNote;
  palosRecomendados?: string[];
  positions: ChordPosition[];
  isCustom: boolean;
}