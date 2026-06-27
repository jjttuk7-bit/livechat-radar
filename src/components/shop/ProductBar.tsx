/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Package, Plus, Star, X } from 'lucide-react';
import { LiveProduct } from '../../types/liveShopping';

interface ProductBarProps {
  products: LiveProduct[];
  onAddClick: () => void;
  onSetActive: (id: string) => void;
  onRemove: (id: string) => void;
}

/** 방송 등록 상품 바 — 현재 소개중(active) 상품 강조. AI 분석 컨텍스트로 전달됨. */
export const ProductBar: React.FC<ProductBarProps> = ({ products, onAddClick, onSetActive, onRemove }) => {
  return (
    <div className="px-6 py-2.5 bg-slate-950/70 border-b border-[rgba(56,189,248,0.1)] flex items-center gap-3 overflow-x-auto">
      <div className="flex items-center gap-1.5 shrink-0 text-slate-400">
        <Package size={14} className="text-cyan-400" />
        <span className="text-[10px] font-bold uppercase tracking-wider font-sans">등록 상품</span>
      </div>

      {products.length === 0 ? (
        <span className="text-[11px] text-slate-600 italic font-sans shrink-0">
          상품을 등록하면 댓글을 상품·옵션 단위로 분석합니다.
        </span>
      ) : (
        products.map((p) => (
          <div
            key={p.id}
            className={`group shrink-0 flex items-center gap-2 pl-2.5 pr-1.5 py-1.5 rounded-lg border text-[11px] font-sans transition-colors ${
              p.isActive
                ? 'bg-cyan-950/40 border-cyan-700/60 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <button
              onClick={() => onSetActive(p.id)}
              className="flex items-center gap-1.5"
              title="현재 소개중 상품으로 지정"
            >
              <Star size={11} className={p.isActive ? 'text-cyan-400 fill-cyan-400' : 'text-slate-600'} />
              <span className={`font-bold ${p.isActive ? 'text-cyan-200' : 'text-slate-300'}`}>{p.name}</span>
              {p.price != null && <span className="font-mono text-slate-500">{p.price.toLocaleString()}원</span>}
              {p.options && p.options.length > 0 && (
                <span className="text-[9px] text-slate-600">· {p.options.length}옵션</span>
              )}
            </button>
            <button
              onClick={() => onRemove(p.id)}
              className="text-slate-700 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
              title="상품 제거"
            >
              <X size={12} />
            </button>
          </div>
        ))
      )}

      <button
        onClick={onAddClick}
        className="shrink-0 ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-700/60 hover:text-cyan-300 text-slate-400 text-[11px] font-bold font-sans transition-colors"
      >
        <Plus size={13} /> 상품 추가
      </button>
    </div>
  );
};
