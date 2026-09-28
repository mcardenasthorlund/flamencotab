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