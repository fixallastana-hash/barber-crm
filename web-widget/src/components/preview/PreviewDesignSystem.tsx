'use client';

import React, { useState } from 'react';

export const PreviewDesignSystem: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'both' | 'dark' | 'light'>('both');

  const darkColors = [
    { name: '--bg-base', hex: '#0F1013', desc: 'Основной тёмный фон' },
    { name: '--bg-elevated', hex: '#16171B', desc: 'Поверхность карточек' },
    { name: '--accent', hex: '#C5A880', desc: 'Шампань / состаренная латунь' },
    { name: '--text-primary', hex: '#F5F5F7', desc: 'Высококонтрастный текст' },
    { name: '--text-secondary', hex: '#A1A3AB', desc: 'Второстепенные описания' },
    { name: '--border-subtle', hex: 'rgba(255,255,255,0.06)', desc: 'Тонкая грань 0.5px' },
  ];

  const lightColors = [
    { name: '--bg-base', hex: '#FAF8F5', desc: 'Тёплый лен (Warm Linen)' },
    { name: '--bg-elevated', hex: '#FFFFFF', desc: 'Чистый молочный белый' },
    { name: '--accent', hex: '#8B6F47', desc: 'Тёмная античная латунь' },
    { name: '--text-primary', hex: '#1A1A1A', desc: 'Глубокий графитовый текст' },
    { name: '--text-secondary', hex: '#5A5A5A', desc: 'Текст описаний для улицы' },
    { name: '--border-subtle', hex: 'rgba(0,0,0,0.06)', desc: 'Мягкий разделитель' },
  ];

  return (
    <section className="mb-14 rounded-3xl border border-white/[0.08] bg-[#16171B] p-6 sm:p-8 shadow-2xl text-white">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.06]">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C5A880]/10 border border-[#C5A880]/20 w-fit mb-2">
            <span className="h-2 w-2 rounded-full bg-[#C5A880] animate-pulse" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#C5A880]">
              Design System 2025 • Dual Theme Architecture
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F5F5F7]">
            Сравнение Dark Luxury vs Light Warm Linen
          </h1>
          <p className="text-sm text-[#A1A3AB] mt-1 max-w-2xl">
            Тёмная тема передаёт клубную вечернюю атмосферу барбершопа, а светлая палитра Warm Linen
            («Old Money») гарантирует максимальную контрастность и читаемость на ярком солнце при записи на ходу.
          </p>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0F1013] border border-white/[0.06] shrink-0">
          <button
            onClick={() => setActiveTab('both')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'both' ? 'bg-[#C5A880] text-[#0F1013] font-bold' : 'text-[#A1A3AB] hover:text-white'
            }`}
          >
            Обе палитры
          </button>
          <button
            onClick={() => setActiveTab('dark')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'dark' ? 'bg-[#C5A880] text-[#0F1013] font-bold' : 'text-[#A1A3AB] hover:text-white'
            }`}
          >
            Dark (#0F1013)
          </button>
          <button
            onClick={() => setActiveTab('light')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'light' ? 'bg-[#8B6F47] text-white font-bold' : 'text-[#A1A3AB] hover:text-white'
            }`}
          >
            Light (#FAF8F5)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
        {(activeTab === 'both' || activeTab === 'dark') && (
          <div className="rounded-2xl border border-white/[0.06] bg-[#0F1013] p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#C5A880]">
                1. Тёмная тема (Dark Luxury)
              </span>
              <span className="text-[11px] text-[#A1A3AB]">Акцент: #C5A880 (Шампань)</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {darkColors.map((c) => (
                <div key={c.name} className="p-2.5 rounded-xl border border-white/[0.06] bg-[#16171B]">
                  <div className="h-6 w-full rounded-md mb-2 border border-white/10" style={{ backgroundColor: c.hex }} />
                  <div className="text-[11px] font-semibold text-white truncate">{c.name}</div>
                  <div className="text-[10px] font-mono text-[#C5A880]">{c.hex}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {(activeTab === 'both' || activeTab === 'light') && (
          <div className="rounded-2xl border border-[#8B6F47]/20 bg-[#FAF8F5] p-4 space-y-3 text-[#1A1A1A]">
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.06]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#8B6F47]">
                2. Светлая тема (Old Money / Warm Linen)
              </span>
              <span className="text-[11px] text-[#5A5A5A]">Акцент: #8B6F47 (Античная латунь)</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {lightColors.map((c) => (
                <div key={c.name} className="p-2.5 rounded-xl border border-black/[0.06] bg-white shadow-sm">
                  <div className="h-6 w-full rounded-md mb-2 border border-black/10" style={{ backgroundColor: c.hex }} />
                  <div className="text-[11px] font-semibold text-[#1A1A1A] truncate">{c.name}</div>
                  <div className="text-[10px] font-mono text-[#8B6F47]">{c.hex}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
