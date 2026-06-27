/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Package, X } from 'lucide-react';
import { LiveProduct } from '../../types/liveShopping';

interface ProductRegisterModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (product: LiveProduct) => void;
  hasActive: boolean;
}

/** 방송 상품 등록 모달 — 멀티상품 + 옵션(쉼표 구분) 입력. */
export const ProductRegisterModal: React.FC<ProductRegisterModalProps> = ({ open, onClose, onAdd, hasActive }) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [options, setOptions] = useState('');
  const [sellingPoints, setSellingPoints] = useState('');
  const [presetFaqsText, setPresetFaqsText] = useState('');
  const [isActive, setIsActive] = useState(!hasActive);

  if (!open) return null;

  const reset = () => {
    setName('');
    setPrice('');
    setOptions('');
    setSellingPoints('');
    setPresetFaqsText('');
    setIsActive(false);
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const parsedPrice = price.trim() ? Number(price.replace(/[^0-9]/g, '')) : undefined;
    const opts = options.split(',').map((o) => o.trim()).filter(Boolean);
    const points = sellingPoints.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
    // "질문 | 답변" 줄 단위 파싱
    const faqs = presetFaqsText
      .split('\n')
      .map((line) => {
        const [q, ...rest] = line.split('|');
        return { q: (q ?? '').trim(), a: rest.join('|').trim() };
      })
      .filter((f) => f.q && f.a);
    onAdd({
      id: `prod-${Date.now()}`,
      name: trimmed,
      price: parsedPrice != null && !Number.isNaN(parsedPrice) ? parsedPrice : undefined,
      options: opts.length > 0 ? opts : undefined,
      sellingPoints: points.length > 0 ? points : undefined,
      presetFaqs: faqs.length > 0 ? faqs : undefined,
      isActive,
    });
    reset();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#0b1329] border border-slate-800 w-full max-w-md rounded-2xl flex flex-col overflow-hidden shadow-2xl animate-fadeIn"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Package className="text-cyan-400 shrink-0" size={18} />
            <h2 className="text-sm font-bold text-white font-sans">방송 상품 등록</h2>
          </div>
          <button onClick={onClose} className="p-1.5 bg-slate-800/80 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded-lg transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">상품명 *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="예: 수분 진정 크림"
              className="mt-1.5 w-full bg-slate-950/90 border border-slate-800 focus:border-cyan-500 focus:outline-none rounded-lg text-xs py-2.5 px-3 text-slate-200 placeholder-slate-600 font-sans transition-colors"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">가격 (원)</label>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="29000"
              inputMode="numeric"
              className="mt-1.5 w-full bg-slate-950/90 border border-slate-800 focus:border-cyan-500 focus:outline-none rounded-lg text-xs py-2.5 px-3 text-slate-200 placeholder-slate-600 font-mono transition-colors"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">옵션 (쉼표로 구분)</label>
            <input
              value={options}
              onChange={(e) => setOptions(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="50ml, 100ml, 리필"
              className="mt-1.5 w-full bg-slate-950/90 border border-slate-800 focus:border-cyan-500 focus:outline-none rounded-lg text-xs py-2.5 px-3 text-slate-200 placeholder-slate-600 font-sans transition-colors"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">셀링포인트 (쉼표/줄바꿈)</label>
            <input
              value={sellingPoints}
              onChange={(e) => setSellingPoints(e.target.value)}
              placeholder="저자극 성분, 12시간 보습, 무향"
              className="mt-1.5 w-full bg-slate-950/90 border border-slate-800 focus:border-cyan-500 focus:outline-none rounded-lg text-xs py-2.5 px-3 text-slate-200 placeholder-slate-600 font-sans transition-colors"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">예상 질문·답변 (한 줄당 "질문 | 답변")</label>
            <textarea
              value={presetFaqsText}
              onChange={(e) => setPresetFaqsText(e.target.value)}
              rows={3}
              placeholder={'배송 며칠 걸려요 | 영업일 기준 2~3일 내 출고됩니다\n환불 되나요 | 단순 변심도 7일 내 가능합니다'}
              className="mt-1.5 w-full bg-slate-950/90 border border-slate-800 focus:border-cyan-500 focus:outline-none rounded-lg text-xs py-2.5 px-3 text-slate-200 placeholder-slate-600 font-sans transition-colors resize-y"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-400 font-sans cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isActive}
              onChange={() => setIsActive(!isActive)}
              className="rounded border-slate-800 bg-slate-950 text-cyan-600 focus:ring-0"
            />
            <span>지금 소개중인 상품으로 지정</span>
          </label>
        </div>

        <div className="px-5 py-4 border-t border-slate-800/80 bg-slate-900/60 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors">
            취소
          </button>
          <button
            onClick={submit}
            disabled={!name.trim()}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-bold rounded-lg transition-colors"
          >
            등록하기
          </button>
        </div>
      </div>
    </div>
  );
};
