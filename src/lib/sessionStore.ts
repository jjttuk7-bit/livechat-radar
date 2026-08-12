/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 회차 영속 저장 (P-11) — 크로스세션 분석의 기반.
 *
 * 두 가지 구현을 같은 인터페이스 뒤에 둔다:
 *   - SupabaseStore : SUPABASE_URL + SUPABASE_SERVICE_KEY 가 있으면 사용 (PostgREST, fetch만 사용)
 *   - FileStore     : 없으면 자동 폴백 (.data/sessions.json)
 *
 * 이 프로젝트의 기존 원칙과 같다 — 키가 없어도 앱은 동작해야 한다.
 * 외부 SDK 의존을 추가하지 않는다(fetch로 충분하며, 이 코드베이스는 axios도 쓰지 않는다).
 *
 * ⚠️ D-8 (개인정보)
 *   - 닉네임은 **해시로만** 저장한다. 원문 닉네임·댓글 원문은 영속 저장하지 않는다.
 *   - 보존기간(기본 90일)이 지난 회차는 쓰기 시점에 정리한다.
 *   - 정치성향은 애초에 계산하지 않으므로 저장 대상 자체가 존재하지 않는다 (D-1).
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { SessionRecord } from '../types/liveTalk.js';

export interface SessionStore {
  readonly kind: 'supabase' | 'file';
  save(record: SessionRecord): Promise<void>;
  /** 최신순 */
  list(limit?: number): Promise<SessionRecord[]>;
  prune(retentionDays: number): Promise<number>;
}

// ── 닉네임 해시 (D-8) ────────────────────────────────────────────────────────

/**
 * 참여자 식별용 단방향 해시.
 *
 * salt가 세션마다 바뀌면 단골 인식이 불가능하므로 **고정 salt**를 쓴다. 그 대가로
 * 같은 salt를 아는 사람은 특정 닉네임의 참여 여부를 조회할 수 있다(사전 공격).
 * 따라서 salt는 비밀로 유지하고, 저장하는 정보는 "참여했다"는 사실뿐이며
 * 성향·발언 내용은 저장하지 않는다.
 */
export function hashAuthor(author: string, salt = process.env.SESSION_HASH_SALT ?? 'livechat-radar-default-salt'): string {
  return createHash('sha256').update(`${salt}:${author}`).digest('hex').slice(0, 32);
}

/** 저장 직전 방어 — 원문 닉네임이 섞여 들어가지 않았는지 확인한다 */
export function assertNoRawAuthors(record: SessionRecord): void {
  const bad = record.participantHashes.filter((h) => !/^[0-9a-f]{32}$/.test(h));
  if (bad.length > 0) {
    throw new Error(
      `[D-8] participantHashes에 해시가 아닌 값이 ${bad.length}건 있습니다. ` +
        `원문 닉네임을 저장하려는 시도입니다: ${bad.slice(0, 2).join(', ')}`,
    );
  }
}

// ── 파일 폴백 ────────────────────────────────────────────────────────────────

export const DEFAULT_DATA_DIR = path.join(process.cwd(), '.data');

export class FileStore implements SessionStore {
  readonly kind = 'file' as const;
  private readonly dir: string;
  private readonly file: string;

  /**
   * 저장 디렉터리를 주입할 수 있게 둔다.
   * 테스트가 기본 경로를 쓰면 앱의 실제 회차 기록을 오염시킨다 — 실제로 그 일이 있었다.
   */
  constructor(dir: string = DEFAULT_DATA_DIR) {
    this.dir = dir;
    this.file = path.join(dir, 'sessions.json');
  }

  private read(): SessionRecord[] {
    try {
      if (!fs.existsSync(this.file)) return [];
      return JSON.parse(fs.readFileSync(this.file, 'utf-8')) as SessionRecord[];
    } catch {
      // 손상된 파일이 앱을 막지 않게 한다 — 크로스세션은 부가 기능이다
      console.warn(`[SessionStore] ${this.file} 파싱 실패 — 빈 목록으로 진행합니다.`);
      return [];
    }
  }

  private write(list: SessionRecord[]): void {
    if (!fs.existsSync(this.dir)) fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(list, null, 2), 'utf-8');
  }

  async save(record: SessionRecord): Promise<void> {
    assertNoRawAuthors(record);
    const list = this.read().filter((r) => r.id !== record.id);
    list.push(record);
    list.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    this.write(list);
  }

  async list(limit = 30): Promise<SessionRecord[]> {
    return this.read().slice(0, limit);
  }

  async prune(retentionDays: number): Promise<number> {
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const list = this.read();
    const kept = list.filter((r) => Date.parse(r.startedAt) >= cutoff);
    if (kept.length !== list.length) this.write(kept);
    return list.length - kept.length;
  }
}

// ── Supabase (PostgREST over fetch) ──────────────────────────────────────────

export class SupabaseStore implements SessionStore {
  readonly kind = 'supabase' as const;
  private readonly base: string;
  private readonly key: string;
  private readonly table = 'talk_sessions';

  constructor(url: string, key: string) {
    this.base = url.replace(/\/$/, '');
    this.key = key;
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      apikey: this.key,
      Authorization: `Bearer ${this.key}`,
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  async save(record: SessionRecord): Promise<void> {
    assertNoRawAuthors(record);
    const res = await fetch(`${this.base}/rest/v1/${this.table}`, {
      method: 'POST',
      headers: this.headers({ Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify([record]),
    });
    if (!res.ok) {
      throw new Error(`Supabase save 실패 ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
  }

  async list(limit = 30): Promise<SessionRecord[]> {
    const res = await fetch(
      `${this.base}/rest/v1/${this.table}?select=*&order=startedAt.desc&limit=${limit}`,
      { headers: this.headers() },
    );
    if (!res.ok) {
      throw new Error(`Supabase list 실패 ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    return (await res.json()) as SessionRecord[];
  }

  async prune(retentionDays: number): Promise<number> {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    const res = await fetch(
      `${this.base}/rest/v1/${this.table}?startedAt=lt.${encodeURIComponent(cutoff)}`,
      { method: 'DELETE', headers: this.headers({ Prefer: 'return=representation' }) },
    );
    if (!res.ok) {
      throw new Error(`Supabase prune 실패 ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const removed = (await res.json()) as unknown[];
    return Array.isArray(removed) ? removed.length : 0;
  }
}

// ── 팩토리 ───────────────────────────────────────────────────────────────────

let cached: SessionStore | null = null;

export function getSessionStore(): SessionStore {
  if (cached) return cached;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (url && key && !url.startsWith('MY_') && !key.startsWith('MY_')) {
    console.log('[SessionStore] Supabase 사용');
    cached = new SupabaseStore(url, key);
  } else {
    console.log('[SessionStore] SUPABASE_URL/SERVICE_KEY 미설정 — 로컬 파일(.data/sessions.json)로 폴백합니다.');
    cached = new FileStore();
  }
  return cached;
}

/** 테스트용 — 팩토리 캐시 초기화 */
export function resetSessionStore(): void {
  cached = null;
}

export const DEFAULT_RETENTION_DAYS = Number(process.env.SESSION_RETENTION_DAYS ?? 90);
