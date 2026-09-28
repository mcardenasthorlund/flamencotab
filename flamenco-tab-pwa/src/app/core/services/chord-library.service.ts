import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Chord } from '../models/chord.model';
import { DEFAULT_CHORDS } from '../constants/default-chords.constant';

const CUSTOM_CHORDS_KEY = 'flamenco_custom_chords';

@Injectable({ providedIn: 'root' })
export class ChordLibraryService {
  private chordsSubject = new BehaviorSubject<Chord[]>(DEFAULT_CHORDS);

  constructor() {
    const customRaw = localStorage.getItem(CUSTOM_CHORDS_KEY);
    const custom: Chord[] = customRaw ? JSON.parse(customRaw) : [];
    this.chordsSubject.next([...DEFAULT_CHORDS, ...custom]);
  }

  getChords(): Observable<Chord[]> {
    return this.chordsSubject.asObservable();
  }

  addCustomChord(chord: Omit<Chord, 'id' | 'isCustom'>): void {
    const newChord: Chord = {
      ...chord,
      id: `chord-custom-${Date.now()}`,
      isCustom: true,
    };
    const custom = this.getCustomChords();
    custom.push(newChord);
    this.persistCustom(custom);
    this.chordsSubject.next([...DEFAULT_CHORDS, ...custom]);
  }

  deleteCustomChord(id: string): void {
    const custom = this.getCustomChords().filter((c) => c.id !== id);
    this.persistCustom(custom);
    this.chordsSubject.next([...DEFAULT_CHORDS, ...custom]);
  }

  resetToDefaults(): void {
    localStorage.removeItem(CUSTOM_CHORDS_KEY);
    this.chordsSubject.next([...DEFAULT_CHORDS]);
  }

  private getCustomChords(): Chord[] {
    const raw = localStorage.getItem(CUSTOM_CHORDS_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  private persistCustom(custom: Chord[]): void {
    localStorage.setItem(CUSTOM_CHORDS_KEY, JSON.stringify(custom));
  }
}