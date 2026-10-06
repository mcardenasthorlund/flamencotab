import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SYNC_CONFIG } from '../models/sync-config';
import { SyncChange, SyncPullResult, SyncPushResult, SyncSession, SyncHttpError } from '../models/sync.model';
import { SyncProvider } from './sync-provider';
import { SyncSessionStore } from '../sync-session.store';

interface AuthResponse {
  token: string;
  expiresAt: string;
  username: string;
}

/**
 * Proveedor que habla con el backend PHP (FlamencoTab Sync API).
 */
@Injectable({ providedIn: 'root' })
export class HttpSyncProvider implements SyncProvider {
  private readonly http = inject(HttpClient);
  private readonly config = inject(SYNC_CONFIG);
  private readonly sessions = inject(SyncSessionStore);

  async register(appId: string, username: string, password: string): Promise<SyncSession> {
    const res = await this.post<AuthResponse>('/auth/register', { appId, username, password }, '');
    return { username: res.username, token: res.token, expiresAt: res.expiresAt };
  }

  async login(appId: string, username: string, password: string): Promise<SyncSession> {
    const res = await this.post<AuthResponse>('/auth/login', { appId, username, password }, '');
    return { username: res.username, token: res.token, expiresAt: res.expiresAt };
  }

  async logout(token: string): Promise<void> {
    try {
      await this.post('/auth/logout', {}, token);
    } catch {
      // El cierre de sesión local no debe fallar por un error de red.
    }
  }

  async deleteAccount(token: string): Promise<void> {
    await this.remove('/account', token);
  }

  async pull(since: number, collections: string[]): Promise<SyncPullResult> {
    const params =
      `?since=${encodeURIComponent(String(since))}` +
      `&collections=${encodeURIComponent(collections.join(','))}`;
    return this.get<SyncPullResult>('/sync/pull' + params);
  }

  async push(changes: SyncChange[]): Promise<SyncPushResult> {
    return this.post<SyncPushResult>('/sync/push', { changes });
  }

  private async get<T>(path: string): Promise<T> {
    try {
      return await firstValueFrom(
        this.http.get<T>(this.url(path), { headers: this.headers() })
      );
    } catch (err) {
      throw this.toError(err);
    }
  }

  private async post<T>(path: string, body: unknown, token?: string): Promise<T> {
    try {
      return await firstValueFrom(
        this.http.post<T>(this.url(path), body, { headers: this.headers(token) })
      );
    } catch (err) {
      throw this.toError(err);
    }
  }

  private async remove<T>(path: string, token?: string): Promise<T> {
    try {
      return await firstValueFrom(
        this.http.delete<T>(this.url(path), { headers: this.headers(token) })
      );
    } catch (err) {
      throw this.toError(err);
    }
  }

  private url(path: string): string {
    return `${this.config.apiBaseUrl.replace(/\/$/, '')}${path}`;
  }

  private headers(token?: string): HttpHeaders {
    const active = token === undefined ? this.sessions.token() : token;
    let headers = new HttpHeaders({ 'Content-Type': 'application/json' });
    if (active) {
      // `Authorization` puede ser descartada por servidores CGI/FastCGI;
      // se envía además `X-Auth-Token`, que siempre llega como HTTP_X_AUTH_TOKEN.
      headers = headers.set('Authorization', `Bearer ${active}`);
      headers = headers.set('X-Auth-Token', active);
    }
    return headers;
  }

  private toError(err: unknown): Error {
    if (err instanceof HttpErrorResponse) {
      const payload = err.error as { message?: string; error?: string } | null;
      const message = payload?.message ?? payload?.error ?? err.message ?? 'Error de red';
      return new SyncHttpError(message, err.status);
    }
    return err instanceof Error ? err : new Error('Error de red');
  }
}
