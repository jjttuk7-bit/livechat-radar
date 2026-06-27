/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * G-3 종료 후 심화 분석 패널 — 리포트 모달 상단의 데이터 시각 분석.
 */

import React from 'react';
import { Award, CheckSquare, Flame, Package, TrendingDown, Users } from 'lucide-react';
import { PostLiveInsights, ProductInterest } from '../../types/liveShopping';
import { ViewerSummary } from '../../lib/buildViewerProfiles';

interface PostLiveAnalysisProps {
  insights: PostLiveInsights;
  summary: ViewerSummary;
  productInterest: ProductInterest[];
}

const fmt = (t: number) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
};

const tempColor = (t: number) => (t >= 60 ? 'bg-rose-500' : t >= 35 ? 'bg-amber-500' : t > 0 ? 'bg-cyan-600' : 'bg-slate-700');

export const PostLiveAnalysis: React.FC<PostLiveAnalysisProps> = ({ insights, summary, productInterest }) => {
  const products = [...productInterest].sort((a, b) => b.interestScore - a.interestScore);
  const maxBucket = Math.max(1, ...insights.timeBuckets.map((b) => b.avgTemp));

  const Section: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
    <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center gap-1.5 mb-2.5">
        {icon}
        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-sans">{title}</h4>
      </div>
      {children}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest font-sans">📊 데이터 분석 (세션 기준)</div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 골든 모먼트 */}
        <Section icon={<Award size={14} className="text-amber-400" />} title="골든 모먼트">
          {insights.goldenMoments.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic font-sans">구매 인증이 누적되면 폭발 구간을 짚어드립니다.</p>
          ) : (
            <div className="space-y-1.5">
              {insights.goldenMoments.map((g, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-mono text-slate-400">{fmt(g.t)}</span>
                  <span className="flex items-center gap-1 text-emerald-400 font-mono font-bold"><Flame size={10} />구매 +{g.purchasedDelta}</span>
                  <span className="text-slate-500 font-sans truncate flex-1 text-right">{g.mention ? `← ${g.mention}` : `온도 ${g.temp}%`}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 시간대 히트맵 */}
        <Section icon={<TrendingDown size={14} className="text-cyan-400" />} title="시간대 구매 온도">
          {insights.timeBuckets.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic font-sans">추이 데이터가 쌓이면 구간별 온도를 표시합니다.</p>
          ) : (
            <div className="flex items-end gap-1.5 h-20">
              {insights.timeBuckets.map((b, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${b.label}: 온도 ${b.avgTemp}% · 구매 ${b.purchased}`}>
                  <span className="text-[8px] font-mono text-slate-500">{b.purchased > 0 ? `+${b.purchased}` : ''}</span>
                  <div className={`w-full rounded-t ${tempColor(b.avgTemp)}`} style={{ height: `${(b.avgTemp / maxBucket) * 100}%`, minHeight: '3px' }} />
                  <span className="text-[8px] font-mono text-slate-600">{i + 1}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 상품 손익 */}
        <Section icon={<Package size={14} className="text-sky-400" />} title="상품별 성과">
          {products.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic font-sans">등록 상품이 없습니다.</p>
          ) : (
            <div className="space-y-1.5">
              {products.map((p, i) => (
                <div key={p.productId} className="flex items-center gap-2 text-[11px]">
                  <span className="font-mono text-slate-500 w-4 shrink-0">#{i + 1}</span>
                  <span className="font-bold text-slate-200 font-sans truncate flex-1">{p.name}</span>
                  <span className="text-slate-500 font-mono shrink-0">질문 {p.questionCount} · 구매 {p.purchasedCount}</span>
                  <span className="text-sky-400 font-mono font-bold w-7 text-right shrink-0">{p.interestScore}</span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 세그먼트 결산 + 이탈 */}
        <Section icon={<Users size={14} className="text-emerald-400" />} title="시청자 결산">
          <div className="grid grid-cols-3 gap-1.5 text-center mb-2">
            <div><div className="text-base font-mono font-bold text-emerald-400">{summary.segments.purchaser}</div><div className="text-[8px] text-slate-500">구매자</div></div>
            <div><div className="text-base font-mono font-bold text-rose-400">{summary.segments.hotLead}</div><div className="text-[8px] text-slate-500">미전환 핫리드</div></div>
            <div><div className="text-base font-mono font-bold text-cyan-400">{summary.segments.regular}</div><div className="text-[8px] text-slate-500">단골</div></div>
          </div>
          <p className={`text-[10px] font-sans leading-snug ${insights.dropOff.detected ? 'text-amber-300' : 'text-slate-500'}`}>
            {insights.dropOff.detected ? '⚠️ ' : ''}{insights.dropOff.note}
          </p>
        </Section>
      </div>

      {/* 다음 방송 체크리스트 */}
      <Section icon={<CheckSquare size={14} className="text-indigo-400" />} title="다음 방송 액션 체크리스트">
        <ul className="space-y-1">
          {insights.checklist.map((c, i) => (
            <li key={i} className="text-[11px] text-slate-300 font-sans flex items-start gap-1.5">
              <span className="text-indigo-400 shrink-0">▸</span>
              <span>{c}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
};
