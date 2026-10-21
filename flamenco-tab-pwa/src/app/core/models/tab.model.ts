import { Ornament } from './ornament.model';

export interface NoteEntry {
  stringNumber: number;
  fret: string;
  tremoloFrets?: string[];
}

export interface TabColumn {
  id: string;
  index: number;
  notes: NoteEntry[];
  ornaments: Ornament[];
  label?: string;
}

export interface LineSet {
  id: string;
  order: number;
  columns: TabColumn[];
}

export interface TabBlock {
  id: string;
  blockOrder: number;
  title?: string;
  lineSets: LineSet[];
}

export interface Tablature {
  id: string;
  title: string;
  palo: string;
  keySignature: string;
  createdDate: string;
  lastModifiedDate: string;
  blocks: TabBlock[];
}

/** Región rectangular seleccionada dentro de una sola tanda de líneas. */
export interface SelectionRange {
  blockIndex: number;
  lineSetIndex: number;
  startColumn: number;
  endColumn: number;
  startString: number;
  endString: number;
}

export interface ClipboardNote {
  stringNumber: number;
  fret: string;
  tremoloFrets?: string[];
}

export interface ClipboardColumn {
  notes: ClipboardNote[];
  ornaments: Ornament[];
  label?: string;
}

/** Contenido copiado de una selección, listo para pegar en otra posición. */
export interface TabClipboard {
  width: number;
  height: number;
  startString: number;
  columns: ClipboardColumn[];
}