/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LiveChat Radar — 정치·시사 분석 회귀 평가 러너 (P-12)
 *
 * Usage:
 *   npm run eval                    # dry-run (로컬 시뮬레이터로 assertion 자체 점검)
 *   npm run eval:live               # 실제 OpenAI 호출 + 채점
 *   npm run eval -- --model gpt-4o  # 모델 오버라이드
 *
 * live 경로는 server.ts와 **동일한 파이프라인**(L1 집계 + 층화 표본)을 사용한다.
 * 러너가 원문 전량을 넘기면 실제 런타임과 다른 것을 평가하게 되어 회귀 검사의 의미가 없다.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
  STATIC_TALK_ANALYZE_SYSTEM_PROMPT,
  talkAnalyzeJsonSchema,
} from '../src/prompts';
import { generateSimulatedTalkAnalysis } from '../src/lib/simulateTalkAnalysis';
import { runPrefilter, formatStatsForPrompt } from '../src/lib/prefilter';
import { applyDerivedAxes } from '../src/lib/normalizeTalk';
import { stratifiedSample, formatSampleForPrompt } from '../src/lib/sample';
import type { LiveIssue } from '../src/types/liveTalk';
import {
  type TalkAnalyzeResponse,
  type FixtureAssertions,
  type AssertResult,
  runUniversal,
  runFixtureSpecific,
  compareSymmetry,
} from './assertions';

dotenv.config();

interface Fixture {
  name: string;
  description: string;
  streamTitle: string;
  issues?: LiveIssue[];
  messages: Array<{ id: string; author: string; message: string; timestamp: string; isSponsor?: boolean }>;
  assertions: FixtureAssertions;
}

interface FixtureResult {
  fixture: string;
  pass: boolean;
  total: number;
  passed: number;
  failed: AssertResult[];
  elapsedMs: number;
  tokens?: { prompt: number; cached: number; completion: number };
  response?: TalkAnalyzeResponse;
  symmetryPair?: string;
}

function parseArgs(): { live: boolean; model: string } {
  const args = process.argv.slice(2);
  const live = args.includes('--live');
  const modelIdx = args.indexOf('--model');
  const model = modelIdx >= 0 && args[modelIdx + 1] ? args[modelIdx + 1] : 'gpt-4o-mini';
  return { live, model };
}

function loadFixtures(): Fixture[] {
  const dir = path.join(__dirname, 'fixtures');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  return files.map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as Fixture);
}

function serializeIssues(issues: LiveIssue[]): string {
  if (issues.length === 0) return '(등록된 큐시트 없음 — issueId/figure는 모두 null로 두십시오.)';
  return issues
    .map((i) => {
      const kw = i.keywords?.length ? ` | 키워드: ${i.keywords.join(', ')}` : '';
      const fg = i.figures?.length ? ` | 인물: ${i.figures.join(', ')}` : '';
      return `- id:${i.id} | ${i.title}${kw}${fg}${i.isActive ? ' | [현재 진행중]' : ''}`;
    })
    .join('\n');
}

async function callAnalyze(
  ai: OpenAI,
  model: string,
  fixture: Fixture,
): Promise<{ response: TalkAnalyzeResponse; usage: any }> {
  const issues = fixture.issues ?? [];

  // server.ts와 동일한 L1 → 표본 경로
  const stats = runPrefilter(fixture.messages, {
    issueKeywords: issues.flatMap((i) => i.keywords ?? []),
    figures: issues.flatMap((i) => i.figures ?? []),
  });
  const sample = stratifiedSample(stats, { size: 80 });

  const userPrompt = `현재 방송 제목: "${fixture.streamTitle}"

[오늘의 큐시트]
${serializeIssues(issues)}

[채팅 집계 통계]
${formatStatsForPrompt(stats)}

[층화 표본 댓글 ${sample.items.length}건 — 원본 ${sample.representedMessages}건을 대표]
${formatSampleForPrompt(sample)}`;

  const completion = await ai.chat.completions.create({
    model,
    temperature: 0, // server.ts와 동일 — 판정 안정성이 곧 대칭성이다
    messages: [
      { role: 'system', content: STATIC_TALK_ANALYZE_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'live_talk_analysis', strict: true, schema: talkAnalyzeJsonSchema as any },
    },
  });

  const text = completion.choices?.[0]?.message?.content ?? '';
  let parsed: TalkAnalyzeResponse;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Failed to parse model output as JSON: ${text.slice(0, 200)}...`);
  }
  // 런타임과 동일한 정규화 — 한쪽만 적용하면 평가와 실제가 갈라진다
  return { response: applyDerivedAxes(parsed), usage: (completion as any).usage ?? null };
}

async function runFixture(
  fixture: Fixture,
  opts: { live: boolean; model: string; ai: OpenAI | null },
): Promise<FixtureResult> {
  const start = Date.now();
  let response: TalkAnalyzeResponse;
  let tokens: FixtureResult['tokens'] | undefined;

  if (opts.live && opts.ai) {
    const { response: r, usage } = await callAnalyze(opts.ai, opts.model, fixture);
    response = r;
    if (usage) {
      tokens = {
        prompt: usage.prompt_tokens ?? 0,
        cached: usage.prompt_tokens_details?.cached_tokens ?? 0,
        completion: usage.completion_tokens ?? 0,
      };
    }
  } else {
    // dry-run: 결정적 로컬 시뮬레이터. fixture 메시지를 실제로 분류하므로
    // universal + specific 모두 의미 있는 self-test가 된다.
    response = generateSimulatedTalkAnalysis(fixture.messages, fixture.issues ?? []);
  }

  const all = [...runUniversal(response), ...runFixtureSpecific(response, fixture.assertions)];
  const failed = all.filter((a) => !a.ok);

  return {
    fixture: fixture.name,
    pass: failed.length === 0,
    total: all.length,
    passed: all.length - failed.length,
    failed,
    elapsedMs: Date.now() - start,
    tokens,
    response,
    symmetryPair: fixture.assertions.symmetryPair,
  };
}

/**
 * 대칭 쌍 검사 (D-7).
 * 개별 fixture가 모두 통과해도, 쌍 사이의 판정이 다르면 편향이다.
 */
function runSymmetryChecks(results: FixtureResult[]): { label: string; results: AssertResult[] }[] {
  const byName = new Map(results.map((r) => [r.fixture, r]));
  const done = new Set<string>();
  const out: { label: string; results: AssertResult[] }[] = [];

  for (const r of results) {
    if (!r.symmetryPair || !r.response) continue;
    if (done.has(r.fixture)) continue;

    const other = byName.get(r.symmetryPair);
    if (!other?.response) {
      out.push({
        label: `${r.fixture} ↔ ${r.symmetryPair}`,
        results: [{ ok: false, label: '[D-7 대칭] 짝 fixture 없음', detail: r.symmetryPair }],
      });
      done.add(r.fixture);
      continue;
    }

    done.add(r.fixture);
    done.add(other.fixture);
    out.push({
      label: `${r.fixture} ↔ ${other.fixture}`,
      results: compareSymmetry(r.fixture, r.response, other.fixture, other.response),
    });
  }

  return out;
}

function printResults(
  results: FixtureResult[],
  symmetry: { label: string; results: AssertResult[] }[],
  opts: { live: boolean; model: string },
): void {
  console.log('');
  console.log('[Eval] LiveChat Radar 정치·시사 분석 회귀 스위트');
  console.log(`[Eval] Mode: ${opts.live ? '--live' : '--dry-run'}  Model: ${opts.model}  Fixtures: ${results.length}`);
  console.log('');

  const cols = ['#', 'Fixture', 'Result', 'Passed', 'Time'];
  const widths = [4, 26, 8, 10, 8];
  const fmt = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join(' │ ');

  console.log('┌' + widths.map((w) => '─'.repeat(w + 2)).join('┬') + '┐');
  console.log('│ ' + fmt(cols) + ' │');
  console.log('├' + widths.map((w) => '─'.repeat(w + 2)).join('┼') + '┤');
  results.forEach((r, idx) => {
    console.log('│ ' + fmt([
      String(idx + 1).padStart(2, '0'),
      r.fixture.slice(0, widths[1]),
      r.pass ? '✓ PASS' : '✗ FAIL',
      `${r.passed}/${r.total}`,
      `${(r.elapsedMs / 1000).toFixed(1)}s`,
    ]) + ' │');
  });
  console.log('└' + widths.map((w) => '─'.repeat(w + 2)).join('┴') + '┘');

  // 대칭 검사 결과
  if (symmetry.length > 0) {
    console.log('');
    console.log('좌우 대칭 회귀 (D-7):');
    for (const s of symmetry) {
      const failed = s.results.filter((x) => !x.ok);
      console.log(`  ${failed.length === 0 ? '✓' : '✗'} ${s.label} — ${s.results.length - failed.length}/${s.results.length}`);
      for (const f of failed) console.log(`     ✗ ${f.label}${f.detail ? ` (${f.detail})` : ''}`);
    }
  }

  const anyFail = results.some((r) => !r.pass);
  if (anyFail) {
    console.log('');
    console.log('실패 상세:');
    results.forEach((r, idx) => {
      if (r.pass) return;
      console.log(`  ${idx + 1}. ${r.fixture}`);
      r.failed.forEach((f) => console.log(`     ✗ ${f.label}${f.detail ? ` (${f.detail})` : ''}`));
    });
  }

  if (opts.live) {
    const totals = results.reduce(
      (acc, r) => {
        if (r.tokens) {
          acc.prompt += r.tokens.prompt;
          acc.cached += r.tokens.cached;
          acc.completion += r.tokens.completion;
        }
        return acc;
      },
      { prompt: 0, cached: 0, completion: 0 },
    );
    const uncached = totals.prompt - totals.cached;
    const isMini = opts.model.includes('mini');
    const inRate = isMini ? 0.15 : 2.5;
    const cachedRate = isMini ? 0.075 : 1.25;
    const outRate = isMini ? 0.6 : 10;
    const cost = (uncached * inRate + totals.cached * cachedRate + totals.completion * outRate) / 1_000_000;
    console.log('');
    console.log(`토큰 사용: prompt=${totals.prompt} (cached=${totals.cached}) completion=${totals.completion}`);
    console.log(`예상 비용: ~$${cost.toFixed(4)} (${opts.model} 기준, 요율은 변동 가능 — 청구서로 확인)`);
  }

  const passCount = results.filter((r) => r.pass).length;
  const symFail = symmetry.reduce((n, s) => n + s.results.filter((x) => !x.ok).length, 0);
  console.log('');
  console.log(`Summary: ${passCount}/${results.length} fixture pass · 대칭 위반 ${symFail}건`);
}

async function main(): Promise<void> {
  const opts = parseArgs();
  const fixtures = loadFixtures();

  if (fixtures.length === 0) {
    console.error('[Eval] fixtures/ 디렉토리에서 fixture를 찾지 못했습니다.');
    process.exit(1);
  }

  let ai: OpenAI | null = null;
  if (opts.live) {
    const key = process.env.OPENAI_API_KEY;
    if (!key || key === 'MY_OPENAI_API_KEY') {
      console.error('[Eval] OPENAI_API_KEY가 설정되어 있지 않습니다. --live 모드 실행 불가.');
      process.exit(1);
    }
    console.warn(`[Eval] 주의: --live 모드입니다. ${fixtures.length}회 OpenAI 호출이 발생하며 비용이 부과됩니다.`);
    ai = new OpenAI({ apiKey: key });
  }

  const results: FixtureResult[] = [];
  for (const f of fixtures) {
    process.stdout.write(`  [${f.name}] 실행 중... `);
    try {
      const r = await runFixture(f, { ...opts, ai });
      process.stdout.write(r.pass ? '✓\n' : `✗ (${r.failed.length} 실패)\n`);
      results.push(r);
    } catch (e: any) {
      process.stdout.write(`✗ 예외: ${e.message}\n`);
      results.push({
        fixture: f.name, pass: false, total: 0, passed: 0,
        failed: [{ ok: false, label: 'runner exception', detail: e.message }],
        elapsedMs: 0,
      });
    }
  }

  const symmetry = runSymmetryChecks(results);
  printResults(results, symmetry, opts);

  const allPass = results.every((r) => r.pass);
  const symPass = symmetry.every((s) => s.results.every((x) => x.ok));
  process.exit(allPass && symPass ? 0 : 1);
}

main().catch((e) => {
  console.error('[Eval] 치명적 오류:', e);
  process.exit(2);
});
