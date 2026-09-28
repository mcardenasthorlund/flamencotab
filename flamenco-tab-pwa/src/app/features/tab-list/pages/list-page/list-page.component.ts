import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { TabStorageService } from '../../../../core/services/tab-storage.service';
import { Tablature } from '../../../../core/models/tab.model';
import { readFileAsText } from '../../../../shared/utils/file.util';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-list-page',
  standalone: true,
  imports: [RouterLink, ConfirmDialogComponent, DatePipe],
  templateUrl: './list-page.component.html',
  styleUrl: './list-page.component.scss',
})
export class ListPageComponent implements OnInit {
  private storage = inject(TabStorageService);
  private router = inject(Router);

  readonly tabs = signal<Tablature[]>([]);
  readonly pendingDelete = signal<string | null>(null);

  ngOnInit(): void {
    this.storage.getAllTabs().subscribe((tabs) => this.tabs.set(tabs));
  }

  createNew(): void {
    const tab = this.storage.createNewTab();
    this.storage.setActiveTab(tab.id);
    this.router.navigate(['/editor', tab.id]);
  }

  openTab(id: string): void {
    this.storage.setActiveTab(id);
  }

  requestDelete(id: string): void {
    this.pendingDelete.set(id);
  }

  confirmDelete(): void {
    const id = this.pendingDelete();
    if (id) this.storage.deleteTab(id).subscribe();
    this.pendingDelete.set(null);
  }

  exportTab(id: string): void {
    this.storage.exportTabAsJson(id);
  }

  async onImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const content = await readFileAsText(file);
    if (!this.storage.importTabFromJson(content)) {
      alert('No se pudo importar el archivo JSON.');
    }
    input.value = '';
  }
}