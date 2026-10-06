import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Chord } from '../models/chord.model';
import { DEFAULT_CHORDS } from '../constants/default-chords.constant';
import { newId } from '../../shared/utils/array.util';
import { SyncService } from '../sync/sync.service';
import { SyncChange, SyncEnvelope } from '../sync/models/sync.model';

const CUSTOM_CHORDS_KEY = 'flamenco_custom_chords';
const COLLECTION = 'chords';

@Injectable({ providedIn: 'root' })
export class ChordLibraryService {
  private chordsSubject = new BehaviorSubject<Chord[]>(DEFAULT_CHORDS);

  constructor(private sync: SyncService) {
    this.sync.registerHandler({
      collection: COLLECTION,
      applyRemote: (envelope) => this.applyRemote(envelope),
      snapshot: () => this.snapshot(),
    });
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
      id: newId('chord-custom'),
      isCustom: true,
      updatedAt: new Date().toISOString(),
    };
    const custom = this.getCustomChords();
    custom.push(newChord);
    this.persistCustom(custom);
    this.chordsSubject.next([...DEFAULT_CHORDS, ...custom]);
    this.sync.enqueue(this.toChange(newChord));
  }

  deleteCustomChord(id: string): void {
    const target = this.getCustomChords().find((c) => c.id === id);
    const custom = this.getCustomChords().filter((c) => c.id !== id);
    this.persistCustom(custom);
    this.chordsSubject.next([...DEFAULT_CHORDS, ...custom]);
    if (target) {
      this.sync.enqueue(this.toChange(target, true));
    }
  }

  resetToDefaults(): void {
    const custom = this.getCustomChords();
    localStorage.removeItem(CUSTOM_CHORDS_KEY);
    this.chordsSubject.next([...DEFAULT_CHORDS]);
    for (const chord of custom) {
      this.sync.enqueue(this.toChange(chord, true));
    }
  }

  private getCustomChords(): Chord[] {
    const raw = localStorage.getItem(CUSTOM_CHORDS_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  private persistCustom(custom: Chord[]): void {
    localStorage.setItem(CUSTOM_CHORDS_KEY, JSON.stringify(custom));
  }

  private toChange(chord: Chord, deleted = false): SyncChange {
    return {
      docId: chord.id,
      collection: COLLECTION,
      clientUpdatedAt: chord.updatedAt ?? new Date().toISOString(),
      deleted,
      payload: deleted ? null : chord,
      schemaVersion: 1,
    };
  }

  private snapshot(): SyncChange[] {
    return this.getCustomChords().map((chord) => this.toChange(chord));
  }

  /** Aplica un documento remoto sin re-encolarlo. */
  private applyRemote(envelope: SyncEnvelope): void {
    const custom = this.getCustomChords().filter((c) => c.id !== envelope.docId);
    if (!envelope.deleted) {
      const chord = envelope.payload as Chord | null;
      if (chord && chord.id) {
        custom.push({ ...chord, isCustom: true, updatedAt: envelope.updatedAt });
      }
    }
    this.persistCustom(custom);
    this.chordsSubject.next([...DEFAULT_CHORDS, ...custom]);
  }
}
