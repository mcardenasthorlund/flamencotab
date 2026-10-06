import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { SwUpdate } from '@angular/service-worker';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { App } from './app';

class MockSwUpdate {
  isEnabled = false;
  versionUpdates = of({ type: 'NO_NEW_VERSION_DETECTED' } as never);
  activateUpdate = () => Promise.resolve(true);
  checkForUpdate = () => Promise.resolve(false);
}

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: SwUpdate, useClass: MockSwUpdate },
        provideHttpClient(),
        provideRouter([]),
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
