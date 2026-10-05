'use client';

import React from 'react';

interface DateStripProps {
  selectedDate: string;
  onSelectDate: (date: string) => void;
  minDate?: string;
  maxDate?: string;
}

export function DateStrip({ selectedDate, onSelectDate }: DateStripProps) {
  const days = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
      dateString,
      dayNumber: d.getDate(),
      weekday: d.toLocaleDateString('ru-RU', { weekday: 'short' }),
      isToday: i === 0,
    };
  });

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x">
      {days.map((item) => {
        const isSelected = item.dateString === selectedDate;
        return (
          <button
            key={item.dateString}
            type="button"
            onClick={() => onSelectDate(item.dateString)}
            className={`flex min-w-[58px] flex-col items-center justify-center rounded-2xl py-3 px-2 transition-all snap-start active:scale-95 ${
              isSelected
                ? 'bg-primary text-white font-bold shadow-lg scale-[1.04]'
                : 'bg-card border border-line text-muted hover:border-ink/20 hover:text-ink shadow-sm'
            }`}
          >
            <span className="text-[10px] uppercase font-semibold">{item.weekday}</span>
            <span className="text-base font-bold mt-0.5">{item.dayNumber}</span>
            {item.isToday && (
              <span className="text-[8px] uppercase tracking-tighter opacity-80 mt-0.5">
                Сегодня
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
