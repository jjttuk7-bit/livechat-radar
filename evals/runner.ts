/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LiveChat Radar — Prompt Regression Evaluation Runner
 *
 * Usage:
 *   npm run eval                 # dry-run (mock 응답으로 assertion 자체 점검)
 *   npm run eval:live            # 실제 OpenAI 호출 + 채점
 *   npm run eval -- --model gpt-4o     # 모델 오버라이드
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import {
  STATIC_ANALYZE_SYSTEM_PROMPT,
  analyzeJsonSchema,
} from '../src/prompts';
import {
  type AnalyzeResponse,
  type FixtureAssertions,
  type AssertResult,
  runUniversal,
  runFixtureSpecific,
  buildMockResponse,
} from './assertions';

dotenv.config();

interface Fixture {
  name: string;
  description: string;
  streamTitle: string;
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
}

// ── CLI 파싱 ────────────────────────────────────────────────────────────────

function parseArgs(): { live: boolean; model: string } {
  const args = process.argv.slice(2);
  const live = args.includes('--live');
  const modelIdx = args.indexOf('--model');
  const model = modelIdx >= 0 && args[modelIdx + 1] ? args[modelIdx + 1] : 'gpt-4o-mini';
  return { live, model };
}

// ── Fixture 로딩 ────────────────────────────────────────────────────────────

function loadFixtures(): Fixture[] {
  const dir = path.join(__dirname, 'fixtures');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  return files.map(f => {
    const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
    const data = JSON.parse(raw) as Fixture;
    return data;
  });
}

// ── OpenAI 호출 ─────────────────────────────────────────────────────────────

async function callAnalyze(
  ai: OpenAI,
  model: string,
  fixture: Fixture,
): Promise<{ response: AnalyzeResponse; usage: any }> {
  const serializedComments = fixture.messages
    .map(m => `[ID:${m.id}] ${m.author}: "${m.message}"`)
    .join('\n');

  const userPrompt = `현재 방송 제목: "${fixture.streamTitle}"
수집된 실시간 최신 댓글 목록 (${fixture.messages.length}개):
${serializedComments}`;

  const completion = await ai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: STATIC_ANALYZE_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'live_chat_analysis',
        strict: true,
        schema: analyzeJsonSchema as any,
      },
    },
  });

  const text = completion.choices?.[0]?.message?.content ?? '';
  let parsed: AnalyzeResponse;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`Failed to parse model output as JSON: ${text.slice(0, 200)}...`);
  }
  return { response: parsed, usage: (completion as any).usage ?? null };
}

// ── 한 fixture 실행 ─────────────────────────────────────────────────────────

async function runFixture(
  fixture: Fixture,
  opts: { live: boolean; model: string; ai: OpenAI | null },
): Promise<FixtureResult> {
  const start = Date.now();
  let response: AnalyzeResponse;
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
    // dry-run: mock 응답으로 assertion 자체 동작 점검
    response = buildMockResponse();
  }

  const universal = runUniversal(response);
  // Dry-run에서는 fixture-specific assertion 생략 (mock 응답은 시나리오를 모름).
  // 의도: dry-run = runner + fixture 파싱 + universal 검증의 self-test.
  //       --live = 실제 시나리오별 응답 품질 채점.
  const specific = opts.live ? runFixtureSpecific(response, fixture.assertions) : [];
  const all = [...universal, ...specific];
  const failed = all.filter(a => !a.ok);

  return {
    fixture: fixture.name,
    pass: failed.length === 0,
    total: all.length,
    passed: all.length - failed.length,
    failed,
    elapsedMs: Date.now() - start,
    tokens,
  };
}

// ── 출력 ────────────────────────────────────────────────────────────────────

function printResults(results: FixtureResult[], opts: { live: boolean; model: string }): void {
  console.log('');
  console.log(`[Eval] LiveChat Radar Analyze Prompt Regression Suite`);
  console.log(`[Eval] Mode: ${opts.live ? '--live' : '--dry-run'}  Model: ${opts.model}  Fixtures: ${results.length}`);
  console.log('');

  // Header
  const cols = ['#', 'Fixture', 'Result', 'Passed', 'Time'];
  const widths = [4, 26, 8, 10, 8];
  const fmt = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i])).join(' │ ');

  console.log('┌' + widths.map(w => '─'.repeat(w + 2)).join('┬') + '┐');
  console.log('│ ' + fmt(cols) + ' │');
  console.log('├' + widths.map(w => '─'.repeat(w + 2)).join('┼') + '┤');

  results.forEach((r, idx) => {
    const row = [
      String(idx + 1).padStart(2, '0'),
      r.fixture.slice(0, widths[1]),
      r.pass ? '✓ PASS' : '✗ FAIL',
      `${r.passed}/${r.total}`,
      `${(r.elapsedMs / 1000).toFixed(1)}s`,
    ];
    console.log('│ ' + fmt(row) + ' │');
  });
  console.log('└' + widths.map(w => '─'.repeat(w + 2)).join('┴') + '┘');

  // Failures detail
  const anyFail = results.some(r => !r.pass);
  if (anyFail) {
    console.log('');
    console.log('실패 상세:');
    results.forEach((r, idx) => {
      if (r.pass) return;
      console.log(`  ${idx + 1}. ${r.fixture}`);
      r.failed.forEach(f => {
        console.log(`     ✗ ${f.label}${f.detail ? ` (${f.detail})` : ''}`);
      });
    });
  }

  // Token summary
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
    const uncachedPrompt = totals.prompt - totals.cached;
    // gpt-4o-mini: $0.15 / 1M input, $0.075 / 1M cached input, $0.60 / 1M output
    // gpt-4o: $2.50 / 1M input, $1.25 / 1M cached input, $10.00 / 1M output
    const isMini = opts.model.includes('mini');
    const inRate = isMini ? 0.15 : 2.5;
    const cachedRate = isMini ? 0.075 : 1.25;
    const outRate = isMini ? 0.6 : 10;
    const cost =
      (uncachedPrompt * inRate + totals.cached * cachedRate + totals.completion * outRate) / 1_000_000;
    console.log('');
    console.log(`토큰 사용: prompt=${totals.prompt} (cached=${totals.cached}) completion=${totals.completion}`);
    console.log(`예상 비용: ~$${cost.toFixed(4)} (${opts.model} 기준)`);
  }

  const passCount = results.filter(r => r.pass).length;
  console.log('');
  console.log(`Summary: ${passCount}/${results.length} pass`);
}

// ── Main ───────────────────────────────────────────────────────────────────

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
      console.error('       .env 파일에 OPENAI_API_KEY=... 설정 후 다시 시도하세요.');
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
        fixture: f.name,
        pass: false,
        total: 0,
        passed: 0,
        failed: [{ ok: false, label: 'runner exception', detail: e.message }],
        elapsedMs: 0,
      });
    }
  }

  printResults(results, opts);
  const allPass = results.every(r => r.pass);
  process.exit(allPass ? 0 : 1);
}

main().catch(e => {
  console.error('[Eval] 치명적 오류:', e);
  process.exit(2);
});
