import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'tabs', pathMatch: 'full' },
  {
    path: 'editor',
    loadComponent: () =>
      import('./features/tab-editor/pages/editor-page/editor-page.component').then(
        (m) => m.EditorPageComponent
      ),
  },
  {
    path: 'editor/:id',
    loadComponent: () =>
      import('./features/tab-editor/pages/editor-page/editor-page.component').then(
        (m) => m.EditorPageComponent
      ),
  },
  {
    path: 'library',
    loadComponent: () =>
      import('./features/chord-library/pages/library-page/library-page.component').then(
        (m) => m.LibraryPageComponent
      ),
  },
  {
    path: 'tabs',
    loadComponent: () =>
      import('./features/tab-list/pages/list-page/list-page.component').then(
        (m) => m.ListPageComponent
      ),
  },
  {
    path: 'help',
    loadComponent: () =>
      import('./features/help/pages/help-page/help-page.component').then(
        (m) => m.HelpPageComponent
      ),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/pages/settings-page/settings-page.component').then(
        (m) => m.SettingsPageComponent
      ),
  },
  { path: '**', redirectTo: 'tabs' },
];