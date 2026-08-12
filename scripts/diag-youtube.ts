/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * P-0 진단 스크립트 — 정치·시사 피벗의 0순위 결정을 실측으로 확정한다.
 * 설계 근거: docs/plans/politics-pivot.md 4-4절 / 13-1절
 *
 * 확인 항목:
 *   ① API 호출 횟수 정확 카운트  → Cloud Console 델타 ÷ 호출수 = 호출당 유닛
 *   ② 실측 CPM + 동시 시청자     → 기획서의 "CPM 200~600" 추정 검증
 *   ③ superChatDetails 수신 여부  → 미결 8번(OAuth 필요성) 해소
 *   ④ streamList 접근 가능 여부   → 수집 방식 전환 판단의 핵심
 *   ⑤ 중복 텍스트 비율           → L1 dedupe 압축률 가정 검증
 *
 * 사용법:
 *   npx tsx scripts/diag-youtube.ts <라이브URL 또는 videoId> [--polls=30] [--maxResults=500]
 */

import dotenv from 'dotenv';

dotenv.config();

const API = 'https://www.googleapis.com/youtube/v3';
const KEY = process.env.YOUTUBE_API_KEY;

// ── 호출 카운터 (①의 핵심 — 엔드포인트별로 정확히 센다) ────────────────────
const calls: Record<string, number> = {};
function countCall(name: string): void {
  calls[name] = (calls[name] ?? 0) + 1;
}

function mask(k: string): string {
  return k.length <= 10 ? '***' : `${k.slice(0, 6)}…${k.slice(-4)}`;
}

function extractVideoId(url: string): string | null {
  const cleaned = url.trim();
  if (cleaned.length === 11 && !cleaned.includes('/') && !cleaned.includes('?')) return cleaned;
  const m = cleaned.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|live\/)([^#\&\?]*).*/);
  return m && m[2].length === 11 ? m[2] : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── ④ streamList 엔드포인트 후보 탐침 ──────────────────────────────────────
// 공식 문서에 HTTP request line이 명시돼 있지 않아 후보 경로를 실제로 찔러본다.
// 스트리밍 엔드포인트는 연결되면 끊기지 않으므로 AbortController로 강제 종료한다.
async function probeStreamList(liveChatId: string): Promise<void> {
  const candidates = [
    `${API}/liveChat/messages/stream`,
    `${API}/liveChat/messages/streamList`,
    `${API}/liveChat/messages:stream`,
  ];

  console.log('\n④ streamList 접근 탐침 (후보 3개)');
  for (const base of candidates) {
    const url = `${base}?liveChatId=${liveChatId}&part=id,snippet,authorDetails&key=${KEY}`;
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 6000);
    countCall(`streamList probe (${base.split('/v3')[1]})`);
    try {
      const res = await fetch(url, { signal: ac.signal });
      if (!res.ok) {
        const body = await res.text();
        let reason = body.slice(0, 160).replace(/\s+/g, ' ');
        try {
          reason = JSON.parse(body)?.error?.message ?? reason;
        } catch { /* 원문 유지 */ }
        console.log(`   ✗ ${res.status} ${base.split('/v3')[1]} — ${reason}`);
        continue;
      }
      // 200이면 스트림이 열린 것 — 일부만 읽고 끊는다.
      let bytes = 0;
      const reader = res.body?.getReader();
      if (reader) {
        try {
          for (let i = 0; i < 3; i++) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value?.byteLength ?? 0;
          }
        } catch { /* abort */ }
        try { await reader.cancel(); } catch { /* noop */ }
      }
      console.log(`   ✅ 200 OK ${base.split('/v3')[1]} — 스트림 수신 ${bytes} bytes (API 키만으로 접근 가능)`);
    } catch (e: any) {
      const msg = e?.name === 'AbortError' ? '6초 타임아웃 (연결은 되었을 수 있음)' : e?.message;
      console.log(`   ⚠ ${base.split('/v3')[1]} — ${msg}`);
    } finally {
      clearTimeout(timer);
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const target = args.find((a) => !a.startsWith('--'));
  const polls = Number(args.find((a) => a.startsWith('--polls='))?.split('=')[1] ?? 30);
  const maxResults = Number(args.find((a) => a.startsWith('--maxResults='))?.split('=')[1] ?? 500);

  if (!KEY || KEY.startsWith('여기에') || KEY === 'MY_YOUTUBE_API_KEY') {
    console.error('✗ YOUTUBE_API_KEY가 .env에 설정되지 않았습니다.');
    process.exitCode = 1;
    return;
  }
  if (!target) {
    console.error('사용법: npx tsx scripts/diag-youtube.ts <라이브URL 또는 videoId> [--polls=30] [--maxResults=500]');
    process.exitCode = 1;
    return;
  }

  const videoId = extractVideoId(target);
  if (!videoId) {
    console.error(`✗ 유효한 유튜브 URL/ID가 아닙니다: ${target}`);
    process.exitCode = 1;
    return;
  }

  console.log('═'.repeat(64));
  console.log(' P-0 YouTube 수집 진단');
  console.log('═'.repeat(64));
  console.log(`키: ${mask(KEY)} · videoId: ${videoId} · 폴링 ${polls}회 · maxResults=${maxResults}`);
  console.log('\n※ 시작 전 Cloud Console 쿼터 소비량을 적어두세요 (종료 후 델타를 봅니다).');

  // ── 방송 정보 ─────────────────────────────────────────────────────────
  countCall('videos.list');
  const infoRes = await fetch(
    `${API}/videos?part=liveStreamingDetails,snippet&id=${videoId}&key=${KEY}`
  );
  if (!infoRes.ok) {
    console.error(`✗ videos.list 실패 ${infoRes.status}: ${(await infoRes.text()).slice(0, 300)}`);
    process.exitCode = 1;
    return;
  }
  const info = await infoRes.json();
  const item = info.items?.[0];
  if (!item) {
    console.error('✗ 해당 비디오를 찾을 수 없습니다.');
    process.exitCode = 1;
    return;
  }

  const liveChatId = item.liveStreamingDetails?.activeLiveChatId;
  const viewers = item.liveStreamingDetails?.concurrentViewers;
  console.log(`\n① 방송 정보`);
  console.log(`   제목: ${item.snippet?.title}`);
  console.log(`   채널: ${item.snippet?.channelTitle}`);
  console.log(`   동시 시청자: ${viewers ?? '(비공개 또는 미제공)'}`);
  console.log(`   activeLiveChatId: ${liveChatId ? '있음' : '없음 — 라이브 중이 아니거나 채팅 비활성'}`);

  if (!liveChatId) {
    console.error('\n✗ 라이브 채팅이 활성 상태가 아닙니다. 진행 중인 라이브 방송으로 다시 시도하세요.');
    console.log(`\n[호출 집계] ${JSON.stringify(calls)}`);
    process.exitCode = 1;
    return;
  }

  // ── 폴링 루프 ─────────────────────────────────────────────────────────
  const seen = new Set<string>();
  const textCounts = new Map<string, number>();
  const typeCounts: Record<string, number> = {};
  const authors = new Set<string>();
  let superChatSeen = 0;
  let superChatWithAmount = 0;
  let sponsorMsgs = 0;
  let duplicateIds = 0;
  const sampleSuperChat: string[] = [];
  let pageToken: string | null = null;
  let firstTs: number | null = null;
  let lastTs: number | null = null;
  const startedAt = Date.now();

  console.log(`\n② 폴링 시작 — ${polls}회`);
  for (let i = 0; i < polls; i++) {
    const tokenParam = pageToken ? `&pageToken=${pageToken}` : '';
    countCall('liveChatMessages.list');
    const res = await fetch(
      `${API}/liveChat/messages?liveChatId=${liveChatId}&part=id,snippet,authorDetails&maxResults=${maxResults}&key=${KEY}${tokenParam}`
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(`   ✗ ${i + 1}회차 실패 ${res.status}: ${body.slice(0, 300)}`);
      break;
    }
    const data = await res.json();
    const items: any[] = data.items ?? [];
    let fresh = 0;
    for (const m of items) {
      if (seen.has(m.id)) { duplicateIds++; continue; }
      seen.add(m.id);
      fresh++;

      const sn = m.snippet ?? {};
      const type = sn.type ?? 'unknown';
      typeCounts[type] = (typeCounts[type] ?? 0) + 1;

      const text: string = sn.displayMessage ?? sn.textMessageDetails?.messageText ?? '';
      if (text) textCounts.set(text, (textCounts.get(text) ?? 0) + 1);

      const ts = Date.parse(sn.publishedAt ?? '');
      if (!Number.isNaN(ts)) {
        if (firstTs === null || ts < firstTs) firstTs = ts;
        if (lastTs === null || ts > lastTs) lastTs = ts;
      }

      if (m.authorDetails?.displayName) authors.add(m.authorDetails.displayName);
      if (m.authorDetails?.isChatSponsor) sponsorMsgs++;

      // ③ superChatDetails — API 키만으로 금액이 오는지가 핵심
      if (type === 'superChatEvent' || type === 'superStickerEvent') {
        superChatSeen++;
        const d = sn.superChatDetails ?? sn.superStickerDetails;
        if (d?.amountDisplayString) {
          superChatWithAmount++;
          if (sampleSuperChat.length < 3) {
            sampleSuperChat.push(`${d.amountDisplayString} (${d.currency ?? '?'}, tier ${d.tier ?? '?'})`);
          }
        }
      }
    }

    pageToken = data.nextPageToken ?? null;
    const wait = Math.max(data.pollingIntervalMillis ?? 3000, 1500);
    process.stdout.write(
      `\r   ${i + 1}/${polls}회 · 신규 ${fresh} · 누적 ${seen.size} · 대기 ${wait}ms   `
    );
    if (i < polls - 1) await sleep(wait);
  }

  const elapsedSec = (Date.now() - startedAt) / 1000;

  // ── 결과 ──────────────────────────────────────────────────────────────
  const dupTexts = [...textCounts.values()].filter((c) => c > 1);
  const dupTextMsgs = dupTexts.reduce((a, c) => a + c, 0) - dupTexts.length;
  const dedupeRate = seen.size > 0 ? (dupTextMsgs / seen.size) * 100 : 0;
  const cpmWall = elapsedSec > 0 ? (seen.size / elapsedSec) * 60 : 0;
  const spanSec = firstTs !== null && lastTs !== null ? (lastTs - firstTs) / 1000 : 0;
  const cpmSpan = spanSec > 0 ? (seen.size / spanSec) * 60 : 0;

  console.log(`\n\n② 실측 결과 (경과 ${elapsedSec.toFixed(0)}초)`);
  console.log(`   수집 메시지: ${seen.size}건 (중복 ID ${duplicateIds}건)`);
  console.log(`   고유 작성자: ${authors.size}명`);
  console.log(`   CPM (경과시간 기준): ${cpmWall.toFixed(1)}`);
  console.log(`   CPM (타임스탬프 기준): ${cpmSpan.toFixed(1)}`);
  if (viewers) {
    console.log(`   CPM / 동시시청자 비율: ${(cpmWall / Number(viewers)).toFixed(3)}`);
  }
  console.log(`   멤버(sponsor) 메시지: ${sponsorMsgs}건`);
  console.log(`   메시지 type 분포: ${JSON.stringify(typeCounts)}`);

  console.log(`\n③ superChatDetails (미결 8번)`);
  if (superChatSeen === 0) {
    console.log('   후원 이벤트가 수집 구간에 없었습니다 — 판정 불가. 후원이 많은 시간대에 재측정 권장.');
  } else {
    console.log(`   후원 이벤트 ${superChatSeen}건 중 금액 수신 ${superChatWithAmount}건`);
    console.log(
      superChatWithAmount > 0
        ? `   ✅ API 키만으로 금액 수신 가능 → OAuth 불필요. 예: ${sampleSuperChat.join(' / ')}`
        : '   ✗ 금액 필드 없음 → 금액 표시에는 OAuth 필요 가능성'
    );
  }

  console.log(`\n⑤ L1 dedupe 압축률 (기획서 4-2 가정 검증)`);
  console.log(`   중복 텍스트로 제거 가능: ${dupTextMsgs}건 / ${seen.size}건 = ${dedupeRate.toFixed(1)}%`);

  await probeStreamList(liveChatId);

  // ── 쿼터 환산 안내 ────────────────────────────────────────────────────
  const listCalls = calls['liveChatMessages.list'] ?? 0;
  console.log('\n' + '═'.repeat(64));
  console.log(' ① 쿼터 환산 — 이 숫자로 계산하세요');
  console.log('═'.repeat(64));
  for (const [k, v] of Object.entries(calls)) console.log(`   ${k}: ${v}회`);
  console.log(`\n   Cloud Console에서 소비 유닛 델타를 확인한 뒤:`);
  console.log(`     (델타 − videos.list 1유닛 − streamList 탐침분) ÷ ${listCalls} = list 호출당 유닛`);
  console.log(`\n   호출당 유닛이 U라면, 3.5초 폴링 3시간 방송 =`);
  console.log(`     3600/3.5 × 3 ≈ 3,086회 × U 유닛 (일 기본 쿼터 10,000과 비교)`);
  console.log('═'.repeat(64));
}

main().catch((e) => {
  console.error('\n✗ 진단 실패:', e?.message ?? e);
  console.log(`[호출 집계] ${JSON.stringify(calls)}`);
  process.exitCode = 1;
});
