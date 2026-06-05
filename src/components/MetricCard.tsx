/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  id: string;
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconColorClass?: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  id,
  title,
  value,
  subtitle,
  icon: Icon,
  iconColorClass = "text-indigo-400",
  badge,
  children
}) => {
  return (
    <div
      id={id}
      className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col justify-between hover:border-slate-700/80 transition-all duration-300 relative overflow-hidden group"
    >
      {/* Background Decorative Blur */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/10 transition-all duration-500"></div>

      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-medium text-slate-400 font-sans">{title}</span>
        <div className={`p-2 bg-slate-800/80 rounded-lg border border-slate-700/50 ${iconColorClass}`}>
          <Icon size={18} className="animate-pulse-slow" />
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-slate-100 font-mono tracking-tight">
          {value}
        </span>
        {badge}
      </div>

      {subtitle && (
        <span className="text-xs text-slate-500 font-sans mt-1.5 block">
          {subtitle}
        </span>
      )}

      {children && (
        <div className="mt-4 pt-4 border-t border-slate-800/80 w-full">
          {children}
        </div>
      )}
    </div>
  );
};
