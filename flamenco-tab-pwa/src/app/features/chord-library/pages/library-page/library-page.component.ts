import { Component, inject, OnInit, signal } from '@angular/core';
import { ChordLibraryService } from '../../../../core/services/chord-library.service';
import { Chord } from '../../../../core/models/chord.model';
import { ChordCardComponent } from '../../components/chord-card/chord-card.component';
import { ChordFormComponent } from '../../components/chord-form/chord-form.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-library-page',
  standalone: true,
  imports: [ChordCardComponent, ChordFormComponent, ConfirmDialogComponent],
  templateUrl: './library-page.component.html',
  styleUrl: './library-page.component.scss',
})
export class LibraryPageComponent implements OnInit {
  private service = inject(ChordLibraryService);

  readonly chords = signal<Chord[]>([]);
  readonly showForm = signal(false);
  readonly showResetConfirm = signal(false);
  readonly pendingDelete = signal<string | null>(null);

  ngOnInit(): void {
    this.service.getChords().subscribe((c) => this.chords.set(c));
  }

  addChord(chord: Omit<Chord, 'id' | 'isCustom'>): void {
    this.service.addCustomChord(chord);
    this.showForm.set(false);
  }

  requestDelete(id: string): void {
    this.pendingDelete.set(id);
  }

  confirmDelete(): void {
    const id = this.pendingDelete();
    if (id) this.service.deleteCustomChord(id);
    this.pendingDelete.set(null);
  }

  requestReset(): void {
    this.showResetConfirm.set(true);
  }

  confirmReset(): void {
    this.service.resetToDefaults();
    this.showResetConfirm.set(false);
  }
}