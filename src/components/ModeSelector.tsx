import React from 'react';
import { CheckCircle2, GraduationCap, Megaphone, RadioTower, ShoppingBag } from 'lucide-react';
import { LiveModeConfig, LiveModeId } from '../types/liveRadar';

interface ModeSelectorProps {
  modes: LiveModeConfig[];
  selectedMode: LiveModeId;
  onSelect: (mode: LiveModeId) => void;
}

const iconByMode = {
  commerce: ShoppingBag,
  education: GraduationCap,
  fandom: RadioTower,
  issue: Megaphone,
} satisfies Record<LiveModeId, typeof ShoppingBag>;

const accentByMode = {
  commerce: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
  education: 'text-cyan-400 border-cyan-500/40 bg-cyan-500/10',
  fandom: 'text-pink-400 border-pink-500/40 bg-pink-500/10',
  issue: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
} satisfies Record<LiveModeId, string>;

export const ModeSelector: React.FC<ModeSelectorProps> = ({ modes, selectedMode, onSelect }) => {
  return (
    <section className="px-6 py-4 bg-slate-950/70 border-b border-[rgba(56,189,248,0.1)]">
      <div className="flex items-center justify-between gap-4 mb-3">
        <div>
          <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-[0.18em]">Purpose Radar Mode</p>
          <h2 className="text-sm md:text-base font-bold text-white tracking-tight">이번 라이브의 목적을 선택하세요</h2>
        </div>
        <span className="hidden md:inline-flex text-[10px] text-slate-500 border border-slate-800 bg-slate-900/80 rounded-md px-2 py-1">
          선택한 목적에 따라 지표, 알림, 액션 카드가 바뀝니다
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {modes.map((mode) => {
          const Icon = iconByMode[mode.id];
          const selected = mode.id === selectedMode;

          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onSelect(mode.id)}
              className={`text-left rounded-xl border p-4 transition-all bg-slate-900/80 hover:bg-slate-900 min-h-[168px] flex flex-col justify-between ${
                selected
                  ? 'border-cyan-400/70 shadow-[0_0_22px_rgba(34,211,238,0.16)]'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${accentByMode[mode.id]}`}>
                  <Icon size={18} />
                </div>
                {selected && <CheckCircle2 size={18} className="text-cyan-300 shrink-0" />}
              </div>

              <div className="mt-4 space-y-2">
                <div>
                  <p className="text-sm font-extrabold text-white">{mode.label}</p>
                  <p className="text-[11px] text-cyan-200 mt-0.5">{mode.userGoalText}</p>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-400">{mode.description}</p>
                <p className="text-[10px] text-slate-500 line-clamp-2">추천 대상: {mode.recommendedFor}</p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
