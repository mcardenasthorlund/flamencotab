import { Component, signal, computed, inject, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Tablature, NoteEntry, TabColumn } from '../../../../core/models/tab.model';
import { TabStorageService } from '../../../../core/services/tab-storage.service';
import { ChordLibraryService } from '../../../../core/services/chord-library.service';
import { Chord } from '../../../../core/models/chord.model';
import { Ornament, OrnamentType } from '../../../../core/models/ornament.model';
import { QUICK_ORNAMENTS } from '../../../../core/constants/ornament.constant';
import { STRING_COUNT } from '../../../../core/constants/guitar.constant';
import { isColumnTremolo } from '../../../../shared/utils/tab-render.util';
import { cloneBlock, cloneLineSet } from '../../../../core/utils/tab.util';
import { moveItem, newId } from '../../../../shared/utils/array.util';
import { take } from 'rxjs';
import { readFileAsText } from '../../../../shared/utils/file.util';
import { TabCanvasComponent, CellSelection, CellLongPressPayload, OrnamentLinePayload, SlurSelectPayload } from '../../components/tab-canvas/tab-canvas.component';
import { OrnamentToolbarComponent } from '../../components/ornament-toolbar/ornament-toolbar.component';
import { ChordPickerDialogComponent } from '../../components/chord-picker-dialog/chord-picker-dialog.component';
import { PrintDialogComponent, PrintOptions } from '../../components/print-dialog/print-dialog.component';
import { PrintSheetComponent } from '../../components/print-sheet/print-sheet.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

@Component({
  selector: 'app-editor-page',
  standalone: true,
  imports: [
    FormsModule,
    TabCanvasComponent,
    OrnamentToolbarComponent,
    ChordPickerDialogComponent,
    PrintDialogComponent,
    PrintSheetComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './editor-page.component.html',
  styleUrl: './editor-page.component.scss',
})
export class EditorPageComponent implements OnInit, OnDestroy {
  private storage = inject(TabStorageService);
  private chordsService = inject(ChordLibraryService);
  private route = inject(ActivatedRoute);

  readonly quickOrnaments = QUICK_ORNAMENTS;

  @ViewChild('printSheet') printSheet!: ElementRef<HTMLElement>;
  readonly exporting = signal(false);

  readonly tab = signal<Tablature | null>(null);
  readonly selectedCell = signal<CellSelection | null>(null);
  readonly activeOrnament = signal<OrnamentType | null>(null);
  readonly showOrnamentMenu = signal(false);
  readonly showChordPicker = signal(false);
  readonly showClearConfirm = signal(false);
  readonly showPrintDialog = signal(false);
  readonly pendingBlockDelete = signal<number | null>(null);
  readonly pendingLineSetDelete = signal<{
    blockIndex: number;
    lineSetIndex: number;
  } | null>(null);
  readonly ornamentMenuPos = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  readonly chords = signal<Chord[]>([]);

  readonly selectedOrnament = signal<{
    ornament: Ornament;
    blockIndex: number;
    lineSetIndex: number;
    columnIndex: number;
  } | null>(null);
  readonly ornamentActionsPos = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  readonly showOrnamentActions = signal(false);
  readonly showOrnamentDeleteConfirm = signal(false);

  readonly selectedSlur = signal<{
    id: string;
    startId: string;
    endId: string;
    blockIndex: number;
    lineSetIndex: number;
  } | null>(null);

  readonly selectedOrnamentId = computed(() => this.selectedOrnament()?.ornament.id ?? null);
  readonly selectedSlurId = computed(() => this.selectedSlur()?.id ?? null);

  readonly ornamentActionLabel = computed(() =>
    this.selectedSlur() ? 'Eliminar ligadura' : 'Eliminar ornamento'
  );
  readonly ornamentDeleteMessage = computed(() =>
    this.selectedSlur()
      ? '¿Eliminar esta ligadura de la tablatura?'
      : '¿Eliminar este ornamento de la tablatura?'
  );

  readonly sheetOptions = signal<PrintOptions>({
    landscape: false,
    showTitle: true,
    showMeta: true,
    author: '',
  });
  readonly sheetWidth = signal(794);

  readonly selectedColumn = computed(() => {
    const cell = this.selectedCell();
    const t = this.tab();
    if (!cell || !t) return null;
    const block = t.blocks[cell.blockIndex];
    const set = block?.lineSets[cell.lineSetIndex];
    return set ? set.columns[cell.columnIndex] : null;
  });

  ngOnInit(): void {
    this.chordsService.getChords().subscribe((c) => this.chords.set(c));
    const id = this.route.snapshot.paramMap.get('id');
    this.loadTab(id);
    window.addEventListener('keydown', this.onKeydown);
  }

  ngOnDestroy(): void {
    window.removeEventListener('keydown', this.onKeydown);
  }

  private onKeydown = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT')
    ) {
      return;
    }
    const key = event.key;
    if (!this.selectedCell()) return;
    if (/^[0-9]$/.test(key)) {
      event.preventDefault();
      this.onFretInput(key);
      return;
    }
    if (key === 'x' || key === 'X') {
      event.preventDefault();
      this.onFretInput('X');
      return;
    }
    if (event.shiftKey && (key === 'T' || key === 't')) {
      event.preventDefault();
      this.onTremolo();
      return;
    }
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
      return;
    }
    event.preventDefault();
    if (event.shiftKey) {
      if (key === 'ArrowUp') this.incrementFret();
      else if (key === 'ArrowDown') this.decrementFret();
      return;
    }
    if (key === 'ArrowLeft') this.moveSelection(-1, 0);
    else if (key === 'ArrowRight') this.moveSelection(1, 0);
    else if (key === 'ArrowUp') this.moveSelection(0, -1);
    else if (key === 'ArrowDown') this.moveSelection(0, 1);
  };

  private moveSelection(dColumn: number, dString: number): void {
    const cell = this.selectedCell();
    const t = this.tab();
    if (!cell || !t) return;
    const block = t.blocks[cell.blockIndex];
    const set = block?.lineSets[cell.lineSetIndex];
    if (!set || !set.columns.length) return;
    const newColumn = Math.min(
      Math.max(cell.columnIndex + dColumn, 0),
      set.columns.length - 1
    );
    const newString = Math.min(Math.max(cell.stringNumber + dString, 1), STRING_COUNT);
    this.selectedCell.set({
      blockIndex: cell.blockIndex,
      lineSetIndex: cell.lineSetIndex,
      columnIndex: newColumn,
      stringNumber: newString,
    });
  }

  private getCurrentNote(): NoteEntry | null {
    const t = this.tab();
    const cell = this.selectedCell();
    if (!t || !cell) return null;
    return this.noteAt(t, cell);
  }

  private columnAt(t: Tablature, cell: CellSelection): TabColumn | null {
    return (
      t.blocks[cell.blockIndex]?.lineSets[cell.lineSetIndex]?.columns[
        cell.columnIndex
      ] ?? null
    );
  }

  private noteAt(t: Tablature, cell: CellSelection): NoteEntry | null {
    return (
      this.columnAt(t, cell)?.notes.find(
        (n) => n.stringNumber === cell.stringNumber
      ) ?? null
    );
  }

  incrementFret(): void {
    const cell = this.selectedCell();
    if (!cell) return;
    const note = this.getCurrentNote();
    if (!note) return;
    const val = parseInt(note.fret, 10);
    const next = (Number.isNaN(val) ? 0 : val) + 1;
    this.mutateTab((t) => {
      const n = this.noteAt(t, cell);
      if (n) n.fret = String(Math.min(next, 24));
    });
  }

  decrementFret(): void {
    const cell = this.selectedCell();
    if (!cell) return;
    const note = this.getCurrentNote();
    if (!note) return;
    const val = parseInt(note.fret, 10);
    if (Number.isNaN(val)) return;
    const next = val - 1;
    this.mutateTab((t) => {
      const n = this.noteAt(t, cell);
      if (n) n.fret = next <= 0 ? '' : String(next);
    });
  }

  private loadTab(id: string | null): void {
    if (id) {
      this.storage.getTabById(id).pipe(take(1)).subscribe((tab) => {
        if (tab) this.tab.set(tab);
        else this.createNew();
      });
    } else {
      const activeId = this.storage.getActiveTabId();
      if (activeId) {
        this.storage.getTabById(activeId).pipe(take(1)).subscribe((tab) => {
          if (tab) {
            this.tab.set(tab);
          } else {
            this.createNew();
          }
        });
      } else {
        this.createNew();
      }
    }
  }

  private createNew(): void {
    const t = this.storage.createNewTab();
    this.tab.set(t);
  }

  onTitleChange(value: string): void {
    const t = this.tab();
    if (!t) return;
    t.title = value;
    this.storage.autoSave(t);
  }

  onPaloChange(value: string): void {
    const t = this.tab();
    if (!t) return;
    t.palo = value;
    this.storage.autoSave(t);
  }

  onKeyChange(value: string): void {
    const t = this.tab();
    if (!t) return;
    t.keySignature = value;
    this.storage.autoSave(t);
  }

  onCellSelect(sel: CellSelection): void {
    this.selectedCell.set(sel);
    this.activeOrnament.set(null);
    this.selectedOrnament.set(null);
    this.selectedSlur.set(null);
    this.showOrnamentActions.set(false);
  }

  onOrnamentLineClick(payload: OrnamentLinePayload): void {
    this.selectedSlur.set(null);
    this.selectedOrnament.set({
      ornament: payload.ornament,
      blockIndex: payload.blockIndex,
      lineSetIndex: payload.lineSetIndex,
      columnIndex: payload.columnIndex,
    });
    this.ornamentActionsPos.set({ x: payload.x, y: payload.y });
    this.showOrnamentActions.set(true);
    this.showOrnamentDeleteConfirm.set(false);
  }

  onSlurSelect(payload: SlurSelectPayload): void {
    this.selectedOrnament.set(null);
    this.selectedSlur.set({
      id: payload.id,
      startId: payload.startId,
      endId: payload.endId,
      blockIndex: payload.blockIndex,
      lineSetIndex: payload.lineSetIndex,
    });
    this.ornamentActionsPos.set({ x: payload.x, y: payload.y });
    this.showOrnamentActions.set(true);
    this.showOrnamentDeleteConfirm.set(false);
  }

  dismissOrnamentActions(): void {
    this.showOrnamentActions.set(false);
    this.selectedOrnament.set(null);
    this.selectedSlur.set(null);
  }

  requestOrnamentDelete(): void {
    this.showOrnamentActions.set(false);
    this.showOrnamentDeleteConfirm.set(true);
  }

  confirmOrnamentDelete(): void {
    const slur = this.selectedSlur();
    const sel = this.selectedOrnament();
    this.showOrnamentDeleteConfirm.set(false);
    this.selectedSlur.set(null);
    this.selectedOrnament.set(null);
    if (slur) {
      this.mutateTab((t) => {
        const set = t.blocks[slur.blockIndex]?.lineSets[slur.lineSetIndex];
        if (!set) return;
        set.columns.forEach((col) => {
          col.ornaments = col.ornaments.filter(
            (o) => o.id !== slur.startId && o.id !== slur.endId
          );
        });
      });
      return;
    }
    if (!sel) return;
    this.mutateTab((t) => {
      const col = this.columnAt(t, {
        blockIndex: sel.blockIndex,
        lineSetIndex: sel.lineSetIndex,
        columnIndex: sel.columnIndex,
        stringNumber: 1,
      });
      if (col) {
        col.ornaments = col.ornaments.filter((o) => o.id !== sel.ornament.id);
      }
    });
  }

  onCellLongPress(payload: CellLongPressPayload): void {
    this.selectedCell.set(payload);
    this.ornamentMenuPos.set({ x: payload.x, y: payload.y });
    this.showOrnamentMenu.set(true);
  }

  requestBlockDelete(blockIndex: number): void {
    this.pendingBlockDelete.set(blockIndex);
  }

  onBlockTitleChange(change: { blockIndex: number; title: string }): void {
    this.mutateTab((t) => {
      const block = t.blocks[change.blockIndex];
      if (block) block.title = change.title;
    });
  }

  confirmBlockDelete(): void {
    const index = this.pendingBlockDelete();
    this.pendingBlockDelete.set(null);
    const t = this.tab();
    if (t === null || index === null) return;
    if (t.blocks.length <= 1) return;
    t.blocks.splice(index, 1);
    this.selectedCell.set(null);
    this.storage.autoSave(t);
    this.tab.set({ ...t });
  }

  onBlockAdd(): void {
    const t = this.tab();
    if (!t) return;
    const block = this.storage.createEmptyBlock(t.blocks.length);
    t.blocks.push(block);
    this.storage.autoSave(t);
    this.tab.set({ ...t });
  }

  onBlockDuplicate(blockIndex: number): void {
    this.mutateTab((t) => {
      const source = t.blocks[blockIndex];
      if (!source) return;
      const copy = cloneBlock(source, t.blocks.length);
      t.blocks.splice(blockIndex + 1, 0, copy);
    });
  }

  onBlockMove(payload: { blockIndex: number; direction: -1 | 1 }): void {
    this.mutateTab((t) => {
      const to = payload.blockIndex + payload.direction;
      if (to < 0 || to >= t.blocks.length) return;
      t.blocks = moveItem(t.blocks, payload.blockIndex, to);
      t.blocks.forEach((b, i) => (b.blockOrder = i));
    });
  }

  onLineSetAdd(blockIndex: number): void {
    this.mutateTab((t) => {
      const block = t.blocks[blockIndex];
      if (!block) return;
      const set = this.storage.createEmptyLineSet(block.lineSets.length);
      block.lineSets.push(set);
    });
  }

  onColumnAdd(payload: { blockIndex: number; lineSetIndex: number }): void {
    this.mutateTab((t) => {
      const set = t.blocks[payload.blockIndex]?.lineSets[payload.lineSetIndex];
      if (!set) return;
      set.columns.push(this.storage.createEmptyColumn(set.columns.length));
    });
  }

  onColumnRemove(payload: { blockIndex: number; lineSetIndex: number }): void {
    this.mutateTab((t) => {
      const set = t.blocks[payload.blockIndex]?.lineSets[payload.lineSetIndex];
      if (!set || set.columns.length <= 1) return;
      set.columns.pop();
      set.columns.forEach((c, i) => (c.index = i));
    });
  }

  onLineSetDuplicate(payload: { blockIndex: number; lineSetIndex: number }): void {
    this.mutateTab((t) => {
      const block = t.blocks[payload.blockIndex];
      const source = block?.lineSets[payload.lineSetIndex];
      if (!block || !source) return;
      const copy = cloneLineSet(source, block.lineSets.length);
      block.lineSets.splice(payload.lineSetIndex + 1, 0, copy);
    });
  }

  onLineSetDelete(payload: { blockIndex: number; lineSetIndex: number }): void {
    this.pendingLineSetDelete.set(payload);
  }

  confirmLineSetDelete(): void {
    const payload = this.pendingLineSetDelete();
    this.pendingLineSetDelete.set(null);
    if (!payload) return;
    this.mutateTab((t) => {
      const block = t.blocks[payload.blockIndex];
      if (!block || block.lineSets.length <= 1) return;
      block.lineSets.splice(payload.lineSetIndex, 1);
    });
    this.selectedCell.set(null);
  }

  onLineSetMove(payload: {
    blockIndex: number;
    lineSetIndex: number;
    direction: -1 | 1;
  }): void {
    this.mutateTab((t) => {
      const block = t.blocks[payload.blockIndex];
      if (!block) return;
      const to = payload.lineSetIndex + payload.direction;
      if (to < 0 || to >= block.lineSets.length) return;
      block.lineSets = moveItem(block.lineSets, payload.lineSetIndex, to);
      block.lineSets.forEach((s, i) => (s.order = i));
    });
  }

  onOrnamentSelected(type: OrnamentType): void {
    this.activeOrnament.set(type);
    const cell = this.selectedCell();
    if (cell) {
      this.addOrnamentToColumn(type, cell.columnIndex);
    }
  }

  onOrnamentMenuOption(type: OrnamentType): void {
    this.showOrnamentMenu.set(false);
    this.activeOrnament.set(type);
    const cell = this.selectedCell();
    if (cell) {
      this.addOrnamentToColumn(type, cell.columnIndex);
    }
  }

  private addOrnamentToColumn(type: OrnamentType, columnIndex: number): void {
    const t = this.tab();
    const cell = this.selectedCell();
    if (!t || !cell) return;
    const col = this.columnAt(t, cell);
    if (!col) return;
    col.ornaments.push({
      id: `orn-${Date.now()}-${Math.random()}`,
      type,
      positionIndex: columnIndex,
      stringIndex: cell.stringNumber,
    });
    this.storage.autoSave(t);
  }

  onFretInput(value: string): void {
    const cell = this.selectedCell();
    if (!cell) return;
    this.mutateTab((t) => {
      const note = this.noteAt(t, cell);
      if (note) note.fret = value;
    });
  }

  onTremolo(): void {
    const cell = this.selectedCell();
    if (!cell) return;
    this.mutateTab((t) => {
      const col = this.columnAt(t, cell);
      if (!col) return;
      const note = this.noteAt(t, cell);
      const idx = col.ornaments.findIndex(
        (o) =>
          o.type === 'tremolo' &&
          o.positionIndex === cell.columnIndex &&
          o.stringIndex === cell.stringNumber
      );
      if (idx >= 0) {
        col.ornaments.splice(idx, 1);
        if (note) delete note.tremoloFrets;
      } else {
        col.ornaments.push({
          id: newId('orn'),
          type: 'tremolo',
          positionIndex: cell.columnIndex,
          stringIndex: cell.stringNumber,
        });
        if (note) {
          const base = note.fret ?? '';
          note.tremoloFrets = [base, base, base, base];
        }
      }
    });
  }

  readonly selectedTremoloNote = computed<NoteEntry | null>(() => {
    const t = this.tab();
    const cell = this.selectedCell();
    if (!t || !cell) return null;
    const col = this.columnAt(t, cell);
    if (!col) return null;
    if (!isColumnTremolo(col, cell.columnIndex, cell.stringNumber)) return null;
    return (
      col.notes.find((n) => n.stringNumber === cell.stringNumber) ?? null
    );
  });

  readonly showTremoloEditor = computed(() => !!this.selectedTremoloNote());

  readonly tremoloFrets = computed<string[]>(() => {
    const note = this.selectedTremoloNote();
    if (!note) return ['', '', '', ''];
    if (note.tremoloFrets?.length === 4) return note.tremoloFrets;
    const base = note.fret ?? '';
    return [base, base, base, base];
  });

  setTremoloFret(index: number, value: string): void {
    const t = this.tab();
    const cell = this.selectedCell();
    if (!t || !cell) return;
    const note = this.noteAt(t, cell);
    if (!note) return;
    if (!note.tremoloFrets || note.tremoloFrets.length !== 4) {
      const base = note.fret ?? '';
      note.tremoloFrets = [base, base, base, base];
    }
    note.tremoloFrets[index] = value;
    this.storage.autoSave(t);
  }

  deleteTremolo(): void {
    const cell = this.selectedCell();
    if (!cell) return;
    this.mutateTab((t) => {
      const note = this.noteAt(t, cell);
      if (note) delete note.tremoloFrets;
      const col = this.columnAt(t, cell);
      if (!col) return;
      col.ornaments = col.ornaments.filter(
        (o) =>
          !(
            o.type === 'tremolo' &&
            o.positionIndex === cell.columnIndex &&
            o.stringIndex === cell.stringNumber
          )
      );
    });
  }

  onChordPicked(chord: Chord): void {
    this.showChordPicker.set(false);
    const cell = this.selectedCell();
    if (!cell) return;
    this.mutateTab((t) => {
      const col = this.columnAt(t, cell);
      if (!col) return;
      for (const pos of chord.positions) {
        const note = col.notes.find((n) => n.stringNumber === pos.stringNumber);
        if (note) note.fret = pos.fret === 'X' ? 'X' : String(pos.fret);
      }
      col.label = chord.name;
    });
  }

  onColumnLabelChange(change: {
    blockIndex: number;
    lineSetIndex: number;
    columnIndex: number;
    label: string;
  }): void {
    const t = this.tab();
    if (!t) return;
    const col =
      t.blocks[change.blockIndex]?.lineSets[change.lineSetIndex]?.columns[
        change.columnIndex
      ];
    if (!col) return;
    col.label = change.label;
    this.storage.autoSave(t);
  }

  private mutateTab(mutator: (t: Tablature) => void): void {
    const current = this.tab();
    if (!current) return;
    const clone = structuredClone(current) as Tablature;
    mutator(clone);
    this.tab.set(clone);
    this.storage.autoSave(clone);
  }

  onSave(): void {
    const t = this.tab();
    if (!t) return;
    this.storage.saveTab(t).subscribe();
  }

  onPrint(): void {
    this.showPrintDialog.set(true);
  }

  onPrintConfirm(options: PrintOptions): void {
    this.showPrintDialog.set(false);
    this.exporting.set(true);
    this.sheetOptions.set(options);
    this.sheetWidth.set(options.landscape ? 1123 : 794);
    const win = window.open('', '_blank');
    setTimeout(() => {
      const el = this.printSheet?.nativeElement;
      if (!el) {
        this.exporting.set(false);
        return;
      }
      html2canvas(el, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      })
        .then((rendered) => {
          const blob = this.buildPdfBlob(rendered, options.landscape);
          const url = URL.createObjectURL(blob);
          if (win) win.location.href = url;
          else window.open(url, '_blank');
        })
        .catch(() => this.exporting.set(false))
        .finally(() => this.exporting.set(false));
    });
  }

  private buildPdfBlob(canvas: HTMLCanvasElement, landscape: boolean): Blob {
    const pdf = new jsPDF({
      orientation: landscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    return pdf.output('blob');
  }

  onExport(): void {
    const t = this.tab();
    if (!t) return;
    this.storage.exportTabAsJson(t.id);
  }

  async onExportPdf(): Promise<void> {
    const t = this.tab();
    if (!t || !this.printSheet) return;
    this.exporting.set(true);
    this.sheetOptions.set({ landscape: true, showTitle: true, showMeta: true, author: '' });
    this.sheetWidth.set(1123);
    try {
      await new Promise((r) => setTimeout(r));
      const canvas = await html2canvas(this.printSheet.nativeElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });
      const blob = this.buildPdfBlob(canvas, true);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tab_${t.title.replace(/\s+/g, '_')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      this.exporting.set(false);
    }
  }

  async onImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const content = await readFileAsText(file);
    if (this.storage.importTabFromJson(content)) {
      this.loadTab(null);
    } else {
      alert('No se pudo importar el archivo JSON.');
    }
    input.value = '';
  }

  onClearConfirm(): void {
    this.showClearConfirm.set(true);
  }

  onClear(): void {
    const t = this.tab();
    if (!t) return;
    t.blocks = [this.storage.createEmptyBlock(0)];
    this.selectedCell.set(null);
    this.showClearConfirm.set(false);
    this.storage.autoSave(t);
  }
}