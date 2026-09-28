import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, debounceTime, map } from 'rxjs';
import { Tablature, TabBlock, LineSet, TabColumn, NoteEntry } from '../models/tab.model';
import { Ornament } from '../models/ornament.model';
import { fillStrings } from '../../shared/utils/guitar.util';
import { newId } from '../../shared/utils/array.util';

const INDEX_KEY = 'flamenco_tabs_index';
const ACTIVE_KEY = 'flamenco_active_tab_id';
const TAB_PREFIX = 'flamenco_tab_';

@Injectable({ providedIn: 'root' })
export class TabStorageService {
  private tabsSubject = new BehaviorSubject<Tablature[]>([]);
  private saveSubject = new Subject<Tablature>();
  private autoSave$ = this.saveSubject.pipe(debounceTime(500));

  constructor() {
    this.autoSave$.subscribe((tab) => {
      tab.lastModifiedDate = new Date().toISOString();
      this.upsertTab(tab);
      this.persistTab(tab);
    });
    this.loadIndex();
  }

  getAllTabs(): Observable<Tablature[]> {
    return this.tabsSubject.asObservable();
  }

  getTabById(id: string): Observable<Tablature | undefined> {
    return this.tabsSubject.asObservable().pipe(
      map((tabs) => tabs.find((t) => t.id === id) ?? this.readFromStorage(id))
    );
  }

  saveTab(tab: Tablature): Observable<void> {
    tab.lastModifiedDate = new Date().toISOString();
    this.upsertTab(tab);
    return new Observable<void>((subscriber) => {
      this.persistTab(tab);
      subscriber.next();
      subscriber.complete();
    });
  }

  autoSave(tab: Tablature): void {
    this.saveSubject.next(tab);
  }

  deleteTab(id: string): Observable<void> {
    const next = this.tabsSubject.value.filter((t) => t.id !== id);
    this.tabsSubject.next(next);
    localStorage.removeItem(TAB_PREFIX + id);
    localStorage.setItem(INDEX_KEY, JSON.stringify(next.map((t) => t.id)));
    return new Observable<void>((subscriber) => {
      subscriber.next();
      subscriber.complete();
    });
  }

  exportTabAsJson(id: string): void {
    const tab = this.readFromStorage(id);
    if (!tab) return;
    const blob = new Blob([JSON.stringify(tab, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tab_${tab.title.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  importTabFromJson(jsonContent: string): boolean {
    try {
      const parsed = JSON.parse(jsonContent) as Tablature;
      if (!parsed.id || !Array.isArray(parsed.blocks)) return false;
      const normalized = this.normalizeTab(parsed);
      this.upsertTab(normalized);
      return true;
    } catch {
      return false;
    }
  }

  createNewTab(): Tablature {
    const id = `tab-${Date.now()}`;
    const now = new Date().toISOString();
    const tab: Tablature = {
      id,
      title: 'Nueva tablatura',
      palo: '',
      keySignature: '',
      createdDate: now,
      lastModifiedDate: now,
      blocks: [this.createEmptyBlock(0)],
    };
    this.upsertTab(tab);
    this.setActiveTab(id);
    return tab;
  }

  getActiveTabId(): string | null {
    return localStorage.getItem(ACTIVE_KEY);
  }

  setActiveTab(id: string): void {
    localStorage.setItem(ACTIVE_KEY, id);
  }

  createEmptyBlock(blockOrder: number): TabBlock {
    return {
      id: newId('block'),
      blockOrder,
      lineSets: [this.createEmptyLineSet(0)],
    };
  }

  createEmptyLineSet(order: number): LineSet {
    return {
      id: newId('line-set'),
      order,
      columns: Array.from({ length: 34 }, (_, i) => this.createEmptyColumn(i)),
    };
  }

  createEmptyColumn(index: number): TabColumn {
    return {
      id: newId('col'),
      index,
      notes: fillStrings((stringNumber) => ({ stringNumber, fret: '' })),
      ornaments: [],
    };
  }

  private upsertTab(tab: Tablature): void {
    const normalized = this.normalizeTab(tab);
    const current = this.tabsSubject.value;
    const idx = current.findIndex((t) => t.id === normalized.id);
    const next = idx >= 0
      ? current.map((t, i) => (i === idx ? normalized : t))
      : [...current, normalized];
    this.tabsSubject.next(next);
    localStorage.setItem(INDEX_KEY, JSON.stringify(next.map((t) => t.id)));
  }

  private persistTab(tab: Tablature): void {
    localStorage.setItem(TAB_PREFIX + tab.id, JSON.stringify(tab));
  }

  private readFromStorage(id: string): Tablature | undefined {
    const raw = localStorage.getItem(TAB_PREFIX + id);
    if (!raw) return undefined;
    try {
      return this.normalizeTab(JSON.parse(raw));
    } catch {
      return undefined;
    }
  }

  private normalizeTab(tab: Tablature): Tablature {
    const blocks: TabBlock[] = (tab.blocks || []).map((block, bi) => {
      const normalizeColumns = (cols: TabColumn[] | undefined): TabColumn[] =>
        (cols || []).map((col, ci) => {
          const notes: NoteEntry[] = fillStrings((stringNumber) => {
            const existing = col.notes?.find((n) => n.stringNumber === stringNumber);
            return existing ?? { stringNumber, fret: '' };
          });
          const ornaments: Ornament[] = (col.ornaments || []).map((o) => ({
            id: o.id || `orn-${Date.now()}-${ci}-${Math.random()}`,
            type: o.type,
            positionIndex: o.positionIndex ?? ci,
            stringIndex: o.stringIndex,
          }));
          return {
            id: col.id || `col-${Date.now()}-${ci}`,
            index: col.index ?? ci,
            notes,
            ornaments,
            label: col.label ?? '',
          };
        });

      // Migración: bloques antiguos tenían `columns` en lugar de `lineSets`
      const rawSets = (block as unknown as { lineSets?: LineSet[] }).lineSets;
      const lineSets: LineSet[] = rawSets && rawSets.length
        ? rawSets.map((ls, li) => ({
            id: ls.id || `line-set-${Date.now()}-${li}`,
            order: ls.order ?? li,
            columns: normalizeColumns(ls.columns),
          }))
        : [
            {
              id: `line-set-${Date.now()}-${bi}`,
              order: 0,
              columns: normalizeColumns((block as unknown as { columns?: TabColumn[] }).columns),
            },
          ];

      return {
        id: block.id || `block-${Date.now()}-${bi}`,
        blockOrder: block.blockOrder ?? bi,
        title: block.title ?? '',
        lineSets,
      };
    });
    return {
      id: tab.id,
      title: tab.title,
      palo: tab.palo,
      keySignature: tab.keySignature,
      createdDate: tab.createdDate,
      lastModifiedDate: tab.lastModifiedDate,
      blocks,
    };
  }

  private loadIndex(): void {
    const raw = localStorage.getItem(INDEX_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    const tabs: Tablature[] = [];
    for (const id of ids) {
      const tab = this.readFromStorage(id);
      if (tab) tabs.push(tab);
    }
    this.tabsSubject.next(tabs);
  }
}