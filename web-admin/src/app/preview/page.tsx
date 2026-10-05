'use client';

import React, { useState } from 'react';
import { PreviewDesignSystem } from '@/components/preview/PreviewDesignSystem';
import {
  PhoneFrame,
  Screen1Landing,
  Screen2Services,
  Screen3Master,
  Screen4DateTime,
  Screen5Confirm,
  Screen6Success,
  type PreviewTheme,
} from '@/components/preview/PreviewScreens';

export default function RedesignPreviewPage() {
  const [globalMode, setGlobalMode] = useState<'compare' | 'dark' | 'light'>('compare');

  const screens = [
    {
      id: 1,
      badge: 'Экран 1',
      title: 'Вход и лендинг виджета',
      desc: 'Hero-секция с атмосферным фото-фоном, статус Premium Gentlemen Salon, преимущества клуба и мгновенный CTA «Записаться онлайн»',
      render: (theme: PreviewTheme) => <Screen1Landing theme={theme} />,
    },
    {
      id: 2,
      badge: 'Экран 2',
      title: 'Каталог услуг',
      desc: 'Кнопка «Назад», чипы категорий («Все», «Стрижки», «Борода», «Комплексы»), цены tabular-nums и плавающая планка с итогом',
      render: (theme: PreviewTheme) => <Screen2Services theme={theme} />,
    },
    {
      id: 3,
      badge: 'Экран 3',
      title: 'Выбор мастера',
      desc: 'Кнопка «Назад», аватар мастера со статусом online, рейтинг, опыт работы и статус-бейджи («Топ-барбер», «Эксперт по бороде»)',
      render: (theme: PreviewTheme) => <Screen3Master theme={theme} />,
    },
    {
      id: 4,
      badge: 'Экран 4',
      title: 'Выбор даты и времени',
      desc: 'Кнопка «Назад», горизонтальный DateStrip на 14 дней, таймслоты с индикацией свободных/занятых окон',
      render: (theme: PreviewTheme) => <Screen4DateTime theme={theme} />,
    },
    {
      id: 5,
      badge: 'Экран 5',
      title: 'Подтверждение (без лишних полей)',
      desc: 'Кнопка «Назад», сводка бронирования, только обязательные поля (Имя, WhatsApp) и Trust Badge «Оплата после стрижки»',
      render: (theme: PreviewTheme) => <Screen5Confirm theme={theme} />,
    },
    {
      id: 6,
      badge: 'Экран 6',
      title: 'Успешная запись',
      desc: 'Пульсирующая галочка успеха, номер брони #BK-9482, WhatsApp-статус и экспорт в календарь в 1 тап',
      render: (theme: PreviewTheme) => <Screen6Success theme={theme} />,
    },
  ];

  return (
    <main className="min-h-screen bg-[#0A0B0D] text-[#F5F5F7] px-4 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-7xl">
        {/* Верхняя плашка управления режимом */}
        <div className="sticky top-4 z-50 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-white/[0.08] bg-[#121316]/95 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#C5A880]/15 border border-[#C5A880]/30 flex items-center justify-center text-[#C5A880] font-bold text-sm">
              VS
            </div>
            <div>
              <div className="text-xs font-semibold text-white flex items-center gap-2">
                <span>Сравнение тем: Dark Luxury vs Light Warm Linen</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Live Preview
                </span>
              </div>
              <div className="text-[11px] text-[#A1A3AB]">
                Проверьте читаемость цен, слотов времени и кнопки записи на ярком свете (уличный сценарий).
              </div>
            </div>
          </div>

          {/* Глобальный переключатель View: Compare | Dark | Light */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#0A0B0D] border border-white/[0.08] shrink-0">
            <button
              onClick={() => setGlobalMode('compare')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                globalMode === 'compare'
                  ? 'bg-gradient-to-r from-[#C5A880] to-[#8B6F47] text-white shadow-md'
                  : 'text-[#A1A3AB] hover:text-white'
              }`}
            >
              Сравнение (Side-by-side)
            </button>
            <button
              onClick={() => setGlobalMode('dark')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                globalMode === 'dark'
                  ? 'bg-[#C5A880] text-[#0F1013] shadow-md'
                  : 'text-[#A1A3AB] hover:text-white'
              }`}
            >
              Только Dark
            </button>
            <button
              onClick={() => setGlobalMode('light')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                globalMode === 'light'
                  ? 'bg-[#8B6F47] text-white shadow-md'
                  : 'text-[#A1A3AB] hover:text-white'
              }`}
            >
              Только Light
            </button>
          </div>
        </div>

        {/* Блок дизайн-системы с обеими палитрами */}
        <PreviewDesignSystem />

        {/* 1. РЕЖИМ СРАВНЕНИЯ SIDE-BY-SIDE */}
        {globalMode === 'compare' && (
          <div className="space-y-20">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#C5A880] block mb-1">
                Side-by-side Comparison
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                Попарное сравнение всех 6 экранов
              </h2>
              <p className="text-xs sm:text-sm text-[#A1A3AB] mt-2">
                Слева — клубная тёмная эстетика с золотом (#0F1013 / #C5A880).<br />
                Справа — премиальная дневная классика Warm Linen с тёмной латунью (#FAF8F5 / #8B6F47).
              </p>
            </div>

            {screens.map((s) => (
              <section
                key={s.id}
                className="p-6 sm:p-8 rounded-3xl border border-white/[0.06] bg-[#121316]/50 shadow-xl"
              >
                <div className="text-center max-w-xl mx-auto mb-8">
                  <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#C5A880]">
                    {s.badge}
                  </span>
                  <h3 className="text-xl font-bold text-white mt-1">{s.title}</h3>
                  <p className="text-xs text-[#A1A3AB] mt-1">{s.desc}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 justify-items-center">
                  <PhoneFrame title={s.title} badgeText="Dark Luxury" theme="dark">
                    {s.render('dark')}
                  </PhoneFrame>

                  <PhoneFrame title={s.title} badgeText="Light Warm Linen" theme="light">
                    {s.render('light')}
                  </PhoneFrame>
                </div>
              </section>
            ))}
          </div>
        )}

        {/* 2. РЕЖИМ ТОЛЬКО DARK */}
        {globalMode === 'dark' && (
          <div className="space-y-12">
            <div className="text-center max-w-xl mx-auto mb-8">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#C5A880] block mb-1">
                Dark Luxury Preview
              </span>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Тёмная тема (6 экранов)
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 items-start justify-items-center">
              {screens.map((s) => (
                <div key={s.id} className="flex flex-col items-center">
                  <div className="mb-3 text-center max-w-[340px]">
                    <p className="text-[11px] text-[#A1A3AB] leading-relaxed mb-2">{s.desc}</p>
                  </div>
                  <PhoneFrame title={s.title} badgeText={s.badge} theme="dark">
                    {s.render('dark')}
                  </PhoneFrame>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. РЕЖИМ ТОЛЬКО LIGHT */}
        {globalMode === 'light' && (
          <div className="space-y-12">
            <div className="text-center max-w-xl mx-auto mb-8">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#8B6F47] block mb-1">
                Warm Linen Preview
              </span>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Светлая тема (6 экранов)
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 items-start justify-items-center">
              {screens.map((s) => (
                <div key={s.id} className="flex flex-col items-center">
                  <div className="mb-3 text-center max-w-[340px]">
                    <p className="text-[11px] text-[#A1A3AB] leading-relaxed mb-2">{s.desc}</p>
                  </div>
                  <PhoneFrame title={s.title} badgeText={s.badge} theme="light">
                    {s.render('light')}
                  </PhoneFrame>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
