import React from 'react';
import { Activity, AlertTriangle, CheckCircle2, Gauge, Signal, Siren } from 'lucide-react';
import { RadarMetric, RadarStatus } from '../types/liveRadar';

interface RadarMetricsProps {
  metrics: RadarMetric[];
}

const statusClass: Record<RadarStatus, string> = {
  good: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  normal: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/30',
  warning: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  danger: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
};

const statusIcon = {
  good: CheckCircle2,
  normal: Signal,
  warning: AlertTriangle,
  danger: Siren,
} satisfies Record<RadarStatus, typeof Activity>;

const statusLabel: Record<RadarStatus, string> = {
  good: '좋음',
  normal: '보통',
  warning: '주의',
  danger: '위험',
};

export const RadarMetrics: React.FC<RadarMetricsProps> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {metrics.map((metric) => {
        const Icon = statusIcon[metric.status];

        return (
          <div key={metric.id} className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-500/5 rounded-full blur-2xl" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] text-slate-400 font-bold">{metric.label}</p>
                <div className="flex items-baseline gap-1.5 mt-2">
                  <span className="font-mono text-2xl font-extrabold text-white">{metric.value}</span>
                  {metric.unit && <span className="text-[11px] text-slate-500">{metric.unit}</span>}
                </div>
              </div>
              <div className={`shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold ${statusClass[metric.status]}`}>
                <Icon size={12} />
                {statusLabel[metric.status]}
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">{metric.description}</p>
          </div>
        );
      })}
    </div>
  );
};
