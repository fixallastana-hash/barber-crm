'use client';

import React, { useState } from 'react';
import {
  IconScissors,
  IconClock,
  IconStar,
  IconShieldCheck,
  IconCheck,
  IconSparkles,
  IconMapPin,
  IconCalendar,
  IconChevronRight,
  IconChevronLeft,
} from './PreviewIcons';

export type PreviewTheme = 'dark' | 'light';

const PhoneStatusBar: React.FC<{ theme?: PreviewTheme }> = ({ theme = 'dark' }) => {
  const isLight = theme === 'light';
  return (
    <div
      className={`flex items-center justify-between px-6 pt-3 pb-2 text-[12px] font-semibold select-none ${
        isLight ? 'text-[#5A5A5A]' : 'text-[#A1A3AB]'
      }`}
    >
      <span>09:41</span>
      <div
        className={`h-4 w-20 rounded-full flex items-center justify-center ${
          isLight ? 'bg-black/10' : 'bg-[#1A1B1F]'
        }`}
      >
        <span className={`h-2 w-2 rounded-full ${isLight ? 'bg-black/20' : 'bg-white/20'}`} />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px]">5G</span>
        <div
          className={`h-2.5 w-5 rounded-[3px] border p-0.5 flex items-center ${
            isLight ? 'border-[#5A5A5A]' : 'border-[#A1A3AB]'
          }`}
        >
          <div className={`h-full w-3 rounded-[1px] ${isLight ? 'bg-[#5A5A5A]' : 'bg-[#A1A3AB]'}`} />
        </div>
      </div>
    </div>
  );
};

const PhoneHomeBar: React.FC<{ theme?: PreviewTheme }> = ({ theme = 'dark' }) => (
  <div className="pt-4 pb-2 flex justify-center">
    <div className={`h-1 w-32 rounded-full ${theme === 'light' ? 'bg-black/20' : 'bg-white/20'}`} />
  </div>
);

const StepHeader: React.FC<{
  stepText: string;
  theme?: PreviewTheme;
  onBack?: () => void;
}> = ({ stepText, theme = 'dark', onBack }) => {
  const isLight = theme === 'light';
  return (
    <div
      className={`flex items-center justify-between pb-3 mb-3 border-b ${
        isLight ? 'border-black/[0.06]' : 'border-white/[0.06]'
      }`}
    >
      <button
        type="button"
        onClick={onBack}
        className={`inline-flex items-center gap-1 px-2.5 py-1.5 -ml-1 rounded-xl text-xs font-semibold transition-all active:scale-[0.96] ${
          isLight
            ? 'bg-black/[0.04] hover:bg-black/[0.08] text-[#8B6F47]'
            : 'bg-white/[0.04] hover:bg-white/[0.08] text-[#C5A880]'
        }`}
      >
        <IconChevronLeft className="w-4 h-4" />
        <span>Назад</span>
      </button>
      <span
        className={`text-[10px] font-bold uppercase tracking-[0.16em] ${
          isLight ? 'text-[#8B6F47]' : 'text-[#C5A880]'
        }`}
      >
        {stepText}
      </span>
      <div className="w-14" />
    </div>
  );
};

export const Screen1Landing: React.FC<{ theme?: PreviewTheme }> = ({ theme = 'dark' }) => {
  const isLight = theme === 'light';

  return (
    <div className="flex-1 flex flex-col justify-between">
      <div>
        <div className="relative h-64 w-full overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=700&q=80"
            alt="Barbershop Atmosphere"
            className="h-full w-full object-cover brightness-[0.7]"
          />
          <div
            className={`absolute inset-0 bg-gradient-to-t ${
              isLight
                ? 'from-[#FAF8F5] via-[#FAF8F5]/60 to-transparent'
                : 'from-[#0F1013] via-[#0F1013]/60 to-transparent'
            }`}
          />

          <div className="absolute top-4 left-4 right-4 flex items-center justify-start">
            <span
              className={`px-3 py-1 rounded-full backdrop-blur-md text-[10px] font-semibold tracking-wider uppercase border ${
                isLight
                  ? 'bg-white/85 text-[#8B6F47] border-black/10 shadow-sm'
                  : 'bg-black/60 text-[#C5A880] border-white/10'
              }`}
            >
              Premium Gentlemen Salon
            </span>
          </div>

          <div className="absolute bottom-4 left-4 right-4">
            <span
              className={`text-[11px] font-bold uppercase tracking-[0.2em] block mb-1 ${
                isLight ? 'text-[#8B6F47]' : 'text-[#C5A880]'
              }`}
            >
              Астана • Премиальный сервис
            </span>
            <h2
              className={`text-2xl font-bold tracking-tight leading-tight font-serif ${
                isLight ? 'text-[#1A1A1A]' : 'text-white'
              }`}
            >
              BARBER CLUB KINGS
            </h2>
          </div>
        </div>

        <div className="p-4 space-y-3.5">
          <div className={`flex items-center gap-2 text-xs ${isLight ? 'text-[#5A5A5A]' : 'text-[#A1A3AB]'}`}>
            <IconMapPin className={`w-4 h-4 shrink-0 ${isLight ? 'text-[#8B6F47]' : 'text-[#C5A880]'}`} />
            <span>пр. Мангилик Ел, 28 (VIP-вход, паркинг)</span>
          </div>

          <p className={`text-xs leading-relaxed ${isLight ? 'text-[#5A5A5A]' : 'text-[#A1A3AB]'}`}>
            Авторские мужские стрижки, традиционное бритьё опасной бритвой и уход 
            за бородой с напитками премиум-бара в атмосфере закрытого джентльменского клуба.
          </p>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <div
              className={`rounded-xl p-2.5 text-center border ${
                isLight ? 'bg-white border-black/[0.06] shadow-sm' : 'bg-[#16171B] border-white/[0.06]'
              }`}
            >
              <IconSparkles className={`w-4 h-4 mx-auto mb-1 ${isLight ? 'text-[#8B6F47]' : 'text-[#C5A880]'}`} />
              <div className={`text-[11px] font-semibold ${isLight ? 'text-[#1A1A1A]' : 'text-white'}`}>
                Top Barbers
              </div>
              <div className={`text-[9px] ${isLight ? 'text-[#8A8A8A]' : 'text-[#6B6D75]'}`}>Опыт от 5 лет</div>
            </div>

            <div
              className={`rounded-xl p-2.5 text-center border ${
                isLight ? 'bg-white border-black/[0.06] shadow-sm' : 'bg-[#16171B] border-white/[0.06]'
              }`}
            >
              <IconClock className={`w-4 h-4 mx-auto mb-1 ${isLight ? 'text-[#8B6F47]' : 'text-[#C5A880]'}`} />
              <div className={`text-[11px] font-semibold ${isLight ? 'text-[#1A1A1A]' : 'text-white'}`}>
                10:00 – 22:00
              </div>
              <div className={`text-[9px] ${isLight ? 'text-[#8A8A8A]' : 'text-[#6B6D75]'}`}>Без выходных</div>
            </div>

            <div
              className={`rounded-xl p-2.5 text-center border ${
                isLight ? 'bg-white border-black/[0.06] shadow-sm' : 'bg-[#16171B] border-white/[0.06]'
              }`}
            >
              <IconShieldCheck className={`w-4 h-4 mx-auto mb-1 ${isLight ? 'text-[#8B6F47]' : 'text-[#C5A880]'}`} />
              <div className={`text-[11px] font-semibold ${isLight ? 'text-[#1A1A1A]' : 'text-white'}`}>
                Гарантия
              </div>
              <div className={`text-[9px] ${isLight ? 'text-[#8A8A8A]' : 'text-[#6B6D75]'}`}>100% стерильно</div>
            </div>
          </div>
        </div>
      </div>

      <div
        className={`p-4 border-t backdrop-blur-md ${
          isLight
            ? 'border-black/[0.06] bg-white/95'
            : 'border-white/[0.06] bg-[#16171B]/90'
        }`}
      >
        <button
          type="button"
          className={`w-full h-13 rounded-2xl font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-transform active:scale-[0.98] ${
            isLight
              ? 'bg-[#8B6F47] text-white hover:bg-[#6F5837] shadow-lg shadow-[#8B6F47]/20'
              : 'bg-[#C5A880] text-[#0F1013] shadow-lg shadow-[#C5A880]/20'
          }`}
        >
          <span>Записаться онлайн</span>
          <IconChevronRight className="w-4 h-4" />
        </button>
        <p className={`text-center text-[10px] mt-2 ${isLight ? 'text-[#8A8A8A]' : 'text-[#6B6D75]'}`}>
          Быстрая запись за 60 секунд без предоплаты
        </p>
      </div>
    </div>
  );
};

export const Screen2Services: React.FC<{ theme?: PreviewTheme }> = ({ theme = 'dark' }) => {
  const isLight = theme === 'light';
  const [activeTab, setActiveTab] = useState('all');
  const [selectedId, setSelectedId] = useState('3');

  const categories = [
    { id: 'all', label: 'Все услуги' },
    { id: 'hair', label: 'Стрижки' },
    { id: 'beard', label: 'Борода & Усы' },
    { id: 'combo', label: 'Комплексы' },
  ];

  const services = [
    {
      id: '1',
      name: 'Мужская авторская стрижка',
      desc: 'Мытьё головы, массаж, консультация, стрижка, укладка премиум-стайлингом',
      duration: '45 мин',
      price: 7000,
      badge: null,
    },
    {
      id: '2',
      name: 'Моделирование бороды',
      desc: 'Контурирование опасным лезвием, распаривание, смягчающее масло',
      duration: '35 мин',
      price: 4500,
      badge: null,
    },
    {
      id: '3',
      name: 'Комплекс «Стрижка + Борода»',
      desc: 'Полный уход в четыре руки: стрижка волос и моделирование бороды',
      duration: '75 мин',
      price: 10500,
      badge: 'Выбор гостей ★',
    },
    {
      id: '4',
      name: 'Королевское бритьё',
      desc: 'Классический английский ритуал горячих компрессов и открытого лезвия',
      duration: '40 мин',
      price: 6000,
      badge: null,
    },
  ];

  return (
    <div className="flex-1 flex flex-col justify-between">
      <div className="p-4">
        <StepHeader stepText="Шаг 1 из 3" theme={theme} />

        <div className="mb-3">
          <h2 className={`text-xl font-bold tracking-tight ${isLight ? 'text-[#1A1A1A]' : 'text-white'}`}>
            Выберите услуги
          </h2>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-[#5A5A5A]' : 'text-[#A1A3AB]'}`}>
            Можно выбрать одну или несколько процедур
          </p>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none mb-3.5">
          {categories.map((c) => {
            const isActive = activeTab === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setActiveTab(c.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? isLight
                      ? 'bg-[#8B6F47] text-white shadow-md shadow-[#8B6F47]/20'
                      : 'bg-[#C5A880] text-[#0F1013] shadow-md shadow-[#C5A880]/20'
                    : isLight
                    ? 'bg-white border border-black/[0.08] text-[#5A5A5A] hover:text-[#1A1A1A]'
                    : 'bg-[#16171B] border border-white/[0.06] text-[#A1A3AB] hover:text-white'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-2.5">
          {services.map((item) => {
            const isSelected = selectedId === item.id;
            return (
              <div
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className={`relative rounded-2xl p-3.5 transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? isLight
                      ? 'border-2 border-[#8B6F47] bg-[#8B6F47]/[0.05] shadow-md'
                      : 'border border-[#C5A880] bg-[#1C1E24] shadow-lg shadow-[#C5A880]/10'
                    : isLight
                    ? 'border border-black/[0.06] bg-white hover:border-black/20 shadow-sm'
                    : 'border border-white/[0.06] bg-[#16171B] hover:border-white/20'
                }`}
              >
                {item.badge && (
                  <span
                    className={`absolute -top-2 right-3 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase ${
                      isLight ? 'bg-[#8B6F47] text-white' : 'bg-[#C5A880] text-[#0F1013]'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected
                          ? isLight
                            ? 'bg-[#8B6F47] text-white'
                            : 'bg-[#C5A880] text-[#0F1013]'
                          : isLight
                          ? 'bg-[#8B6F47]/10 text-[#8B6F47]'
                          : 'bg-white/[0.05] text-[#C5A880]'
                      }`}
                    >
                      <IconScissors className="w-4 h-4" />
                    </div>
                    <div>
                      <div className={`text-[13px] font-bold leading-snug ${isLight ? 'text-[#1A1A1A]' : 'text-white'}`}>
                        {item.name}
                      </div>
                      <div className={`text-[11px] line-clamp-1 mt-0.5 ${isLight ? 'text-[#5A5A5A]' : 'text-[#A1A3AB]'}`}>
                        {item.desc}
                      </div>
                      <div className={`flex items-center gap-1.5 mt-1.5 text-[10px] ${isLight ? 'text-[#8A8A8A]' : 'text-[#6B6D75]'}`}>
                        <IconClock className="w-3 h-3" />
                        <span>{item.duration}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-sm font-bold tabular-nums block ${
                        isLight ? 'text-[#8B6F47]' : 'text-[#C5A880]'
                      }`}
                    >
                      {item.price.toLocaleString('ru-RU')} ₸
                    </span>
                    <span
                      className={`inline-block mt-2 h-5 w-5 rounded-full border flex items-center justify-center text-[10px] ${
                        isSelected
                          ? isLight
                            ? 'border-[#8B6F47] bg-[#8B6F47] text-white'
                            : 'border-[#C5A880] bg-[#C5A880] text-[#0F1013]'
                          : isLight
                          ? 'border-black/20 bg-black/5'
                          : 'border-white/20 bg-white/5'
                      }`}
                    >
                      {isSelected && <IconCheck className="w-3 h-3 stroke-[3]" />}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className={`p-4 border-t backdrop-blur-md flex items-center justify-between gap-3 ${
          isLight ? 'border-black/[0.06] bg-white/95' : 'border-white/[0.06] bg-[#16171B]/95'
        }`}
      >
        <div>
          <span className={`text-[10px] uppercase tracking-wider block ${isLight ? 'text-[#5A5A5A]' : 'text-[#A1A3AB]'}`}>
            1 услуга выбрана
          </span>
          <span className={`text-base font-bold tabular-nums ${isLight ? 'text-[#1A1A1A]' : 'text-white'}`}>
            10 500 ₸
          </span>
        </div>
        <button
          type="button"
          className={`h-11 px-5 rounded-xl font-bold text-xs tracking-wide transition-transform active:scale-[0.98] ${
            isLight ? 'bg-[#8B6F47] text-white shadow-md' : 'bg-[#C5A880] text-[#0F1013]'
          }`}
        >
          Далее: Мастер →
        </button>
      </div>
    </div>
  );
};

export const Screen3Master: React.FC<{ theme?: PreviewTheme }> = ({ theme = 'dark' }) => {
  const isLight = theme === 'light';
  const [selectedMaster, setSelectedMaster] = useState('1');

  const masters = [
    {
      id: '1',
      name: 'Алихан Сарсенов',
      role: 'Top Barber & Stylist',
      rating: 4.96,
      reviewsCount: 184,
      experience: '7 лет опыта',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80',
      badges: [
        {
          label: 'Топ-барбер',
          color: isLight
            ? 'bg-[#8B6F47]/10 text-[#8B6F47] border-[#8B6F47]/30'
            : 'bg-[#C5A880]/15 text-[#C5A880] border-[#C5A880]/30',
        },
        {
          label: 'Эксперт по бороде',
          color: isLight
            ? 'bg-emerald-600/10 text-emerald-800 border-emerald-600/30'
            : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        },
        {
          label: 'Выбор гостей',
          color: isLight
            ? 'bg-indigo-600/10 text-indigo-800 border-indigo-600/30'
            : 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
        },
      ],
    },
    {
      id: '2',
      name: 'Данияр Мусин',
      role: 'Senior Barber',
      rating: 4.91,
      reviewsCount: 112,
      experience: '4 года опыта',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80',
      badges: [
        {
          label: 'Классические стрижки',
          color: isLight
            ? 'bg-black/5 text-[#1A1A1A] border-black/15'
            : 'bg-white/10 text-white/90 border-white/20',
        },
        {
          label: 'Fade Master',
          color: isLight
            ? 'bg-[#8B6F47]/10 text-[#8B6F47] border-[#8B6F47]/30'
            : 'bg-[#C5A880]/15 text-[#C5A880] border-[#C5A880]/30',
        },
      ],
    },
  ];

  return (
    <div className="flex-1 flex flex-col justify-between">
      <div className="p-4 space-y-3.5">
        <StepHeader stepText="Шаг 2 из 3" theme={theme} />

        <div>
          <h2 className={`text-xl font-bold tracking-tight ${isLight ? 'text-[#1A1A1A]' : 'text-white'}`}>
            Выберите мастера
          </h2>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-[#5A5A5A]' : 'text-[#A1A3AB]'}`}>
            Опыт и специализация барбера
          </p>
        </div>

        <div
          onClick={() => setSelectedMaster('any')}
          className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
            selectedMaster === 'any'
              ? isLight
                ? 'border-2 border-[#8B6F47] bg-[#8B6F47]/[0.05]'
                : 'border border-[#C5A880] bg-[#1C1E24]'
              : isLight
              ? 'border border-black/[0.06] bg-white shadow-sm'
              : 'border border-white/[0.06] bg-[#16171B]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`h-10 w-10 rounded-xl border flex items-center justify-center ${
                isLight ? 'bg-[#8B6F47]/10 border-[#8B6F47]/20 text-[#8B6F47]' : 'bg-white/5 border-white/10 text-[#C5A880]'
              }`}
            >
              <IconSparkles className="w-5 h-5" />
            </div>
            <div>
              <div className={`text-xs font-semibold ${isLight ? 'text-[#1A1A1A]' : 'text-white'}`}>
                Любой свободный мастер
              </div>
              <div className={`text-[10px] ${isLight ? 'text-[#5A5A5A]' : 'text-[#A1A3AB]'}`}>
                Ближайшее доступное окно
              </div>
            </div>
          </div>
          <span className={`text-[11px] font-semibold ${isLight ? 'text-[#8B6F47]' : 'text-[#C5A880]'}`}>
            Быстрее всего
          </span>
        </div>

        <div className="space-y-3">
          {masters.map((m) => {
            const isSelected = selectedMaster === m.id;
            return (
              <div
                key={m.id}
                onClick={() => setSelectedMaster(m.id)}
                className={`rounded-2xl p-4 transition-all cursor-pointer ${
                  isSelected
                    ? isLight
                      ? 'border-2 border-[#8B6F47] bg-white shadow-md'
                      : 'border border-[#C5A880] bg-[#1C1E24] shadow-lg shadow-[#C5A880]/10'
                    : isLight
                    ? 'border border-black/[0.06] bg-white hover:border-black/20 shadow-sm'
                    : 'border border-white/[0.06] bg-[#16171B] hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="relative">
                      <img
                        src={m.avatar}
                        alt={m.name}
                        className={`h-14 w-14 rounded-2xl object-cover border-2 ${
                          isLight ? 'border-[#8B6F47]' : 'border-[#C5A880]'
                        }`}
                      />
                      <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-white" />
                    </div>
                    <div>
                      <div className={`text-[15px] font-bold tracking-tight ${isLight ? 'text-[#1A1A1A]' : 'text-white'}`}>
                        {m.name}
                      </div>
                      <div className={`text-xs ${isLight ? 'text-[#5A5A5A]' : 'text-[#A1A3AB]'}`}>{m.role}</div>
                      <div className={`flex items-center gap-1.5 mt-1 text-xs font-semibold ${isLight ? 'text-[#8B6F47]' : 'text-[#C5A880]'}`}>
                        <IconStar className="w-3.5 h-3.5" />
                        <span>{m.rating}</span>
                        <span className={`text-[10px] ${isLight ? 'text-[#8A8A8A]' : 'text-[#6B6D75]'}`}>
                          • {m.reviewsCount} отзывов • {m.experience}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`h-6 w-6 rounded-full border flex items-center justify-center text-xs transition-colors shrink-0 ${
                      isSelected
                        ? isLight
                          ? 'border-[#8B6F47] bg-[#8B6F47] text-white'
                          : 'border-[#C5A880] bg-[#C5A880] text-[#0F1013]'
                        : isLight
                        ? 'border-black/20 bg-black/5'
                        : 'border-white/20 bg-white/5'
                    }`}
                  >
                    {isSelected && <IconCheck className="w-3 h-3 stroke-[3]" />}
                  </span>
                </div>

                <div
                  className={`flex flex-wrap gap-1.5 mt-3 pt-3 border-t ${
                    isLight ? 'border-black/[0.06]' : 'border-white/[0.06]'
                  }`}
                >
                  {m.badges.map((b) => (
                    <span key={b.label} className={`text-[9px] font-semibold px-2.5 py-0.5 rounded-full border ${b.color}`}>
                      {b.label}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div
        className={`p-4 border-t backdrop-blur-md flex items-center justify-between ${
          isLight ? 'border-black/[0.06] bg-white/95' : 'border-white/[0.06] bg-[#16171B]/95'
        }`}
      >
        <div>
          <span className={`text-[10px] uppercase tracking-wider block ${isLight ? 'text-[#5A5A5A]' : 'text-[#A1A3AB]'}`}>
            Мастер выбран
          </span>
          <span className={`text-xs font-bold ${isLight ? 'text-[#1A1A1A]' : 'text-white'}`}>
            Алихан Сарсенов
          </span>
        </div>
        <button
          type="button"
          className={`h-11 px-5 rounded-xl font-bold text-xs tracking-wide transition-transform active:scale-[0.98] ${
            isLight ? 'bg-[#8B6F47] text-white shadow-md' : 'bg-[#C5A880] text-[#0F1013]'
          }`}
        >
          Далее: Дата и время →
        </button>
      </div>
    </div>
  );
};

export const Screen4DateTime: React.FC<{ theme?: PreviewTheme }> = ({ theme = 'dark' }) => {
  const isLight = theme === 'light';
  const [selectedDay, setSelectedDay] = useState(2);
  const [selectedTime, setSelectedTime] = useState('15:30');

  const days = [
    { date: 23, day: 'Ср', isToday: true },
    { date: 24, day: 'Чт', isToday: false },
    { date: 25, day: 'Пт', isToday: false },
    { date: 26, day: 'Сб', isToday: false },
    { date: 27, day: 'Вс', isToday: false },
    { date: 28, day: 'Пн', isToday: false },
    { date: 29, day: 'Вт', isToday: false },
  ];

  const slots = [
    { time: '11:00', status: 'free' },
    { time: '12:30', status: 'free' },
    { time: '14:00', status: 'free' },
    { time: '15:30', status: 'free' },
    { time: '17:00', status: 'busy' },
    { time: '18:30', status: 'free' },
    { time: '20:00', status: 'free' },
    { time: '21:15', status: 'busy' },
  ];

  return (
    <div className="flex-1 flex flex-col justify-between">
      <div className="p-4 space-y-4">
        <StepHeader stepText="Шаг 3 из 3" theme={theme} />

        <div>
          <h2 className={`text-xl font-bold tracking-tight ${isLight ? 'text-[#1A1A1A]' : 'text-white'}`}>
            Дата и время визита
          </h2>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-[#5A5A5A]' : 'text-[#A1A3AB]'}`}>
            Октябрь 2026 • Часовой пояс Астана (UTC+5)
          </p>
        </div>

        <div>
          <div className={`text-[11px] font-semibold mb-2 uppercase tracking-wider ${isLight ? 'text-[#5A5A5A]' : 'text-[#A1A3AB]'}`}>
            Выберите день
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-x">
            {days.map((d, index) => {
              const isSelected = selectedDay === index;
              return (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => setSelectedDay(index)}
                  className={`flex min-w-[56px] flex-col items-center justify-center rounded-2xl py-3 px-2 transition-all ${
                    isSelected
                      ? isLight
                        ? 'bg-[#8B6F47] text-white font-bold shadow-md shadow-[#8B6F47]/20 scale-[1.04]'
                        : 'bg-[#C5A880] text-[#0F1013] font-bold shadow-lg shadow-[#C5A880]/20 scale-[1.04]'
                      : isLight
                      ? 'bg-white border border-black/[0.08] text-[#5A5A5A] hover:border-black/20 shadow-sm'
                      : 'bg-[#16171B] border border-white/[0.06] text-[#A1A3AB] hover:border-white/20'
                  }`}
                >
                  <span className="text-[10px] uppercase font-semibold">{d.day}</span>
                  <span className="text-base font-bold mt-0.5">{d.date}</span>
                  {d.isToday && (
                    <span className="text-[8px] uppercase tracking-tighter opacity-80 mt-0.5">
                      Сегодня
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${isLight ? 'text-[#5A5A5A]' : 'text-[#A1A3AB]'}`}>
              Доступное время
            </span>
            <span className={`text-[10px] ${isLight ? 'text-[#8A8A8A]' : 'text-[#6B6D75]'}`}>Слот 75 мин</span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {slots.map((s) => {
              const isBusy = s.status === 'busy';
              const isSelected = selectedTime === s.time;
              return (
                <button
                  key={s.time}
                  disabled={isBusy}
                  onClick={() => setSelectedTime(s.time)}
                  className={`h-11 rounded-xl text-xs font-semibold tabular-nums transition-all ${
                    isBusy
                      ? isLight
                        ? 'bg-black/[0.03] text-[#8A8A8A] line-through cursor-not-allowed opacity-50 border border-black/[0.04]'
                        : 'bg-white/[0.02] text-[#6B6D75] line-through cursor-not-allowed opacity-40 border border-white/[0.03]'
                      : isSelected
                      ? isLight
                        ? 'bg-[#8B6F47] text-white shadow-md font-bold'
                        : 'bg-[#C5A880] text-[#0F1013] shadow-md font-bold'
                      : isLight
                      ? 'bg-white border border-black/[0.08] text-[#1A1A1A] hover:border-[#8B6F47]/50 shadow-sm'
                      : 'bg-[#16171B] border border-white/[0.06] text-white hover:border-[#C5A880]/40'
                  }`}
                >
                  {s.time}
                </button>
              );
            })}
          </div>
        </div>

        <div
          className={`flex items-center gap-2.5 p-3 rounded-xl border text-[11px] ${
            isLight
              ? 'border-black/[0.06] bg-white text-[#5A5A5A] shadow-sm'
              : 'border-white/[0.06] bg-[#16171B] text-[#A1A3AB]'
          }`}
        >
          <IconClock className={`w-4 h-4 shrink-0 ${isLight ? 'text-[#8B6F47]' : 'text-[#C5A880]'}`} />
          <span>Напоминание придёт в WhatsApp за 24 часа и за 2 часа до визита.</span>
        </div>
      </div>

      <div
        className={`p-4 border-t backdrop-blur-md flex items-center justify-between ${
          isLight ? 'border-black/[0.06] bg-white/95' : 'border-white/[0.06] bg-[#16171B]/95'
        }`}
      >
        <div>
          <span className={`text-[10px] uppercase tracking-wider block ${isLight ? 'text-[#5A5A5A]' : 'text-[#A1A3AB]'}`}>
            Чт, 24 октября • 15:30
          </span>
          <span className={`text-base font-bold tabular-nums ${isLight ? 'text-[#8B6F47]' : 'text-[#C5A880]'}`}>
            10 500 ₸
          </span>
        </div>
        <button
          type="button"
          className={`h-11 px-5 rounded-xl font-bold text-xs tracking-wide transition-transform active:scale-[0.98] ${
            isLight ? 'bg-[#8B6F47] text-white shadow-md' : 'bg-[#C5A880] text-[#0F1013]'
          }`}
        >
          Перейти к бронированию →
        </button>
      </div>
    </div>
  );
};

export const Screen5Confirm: React.FC<{ theme?: PreviewTheme }> = ({ theme = 'dark' }) => {
  const isLight = theme === 'light';
  const [phone, setPhone] = useState('+7 (701) 849-20-11');
  const [name, setName] = useState('Арман');

  return (
    <div className="flex-1 flex flex-col justify-between">
      <div className="p-4 space-y-4">
        <StepHeader stepText="Финальный шаг" theme={theme} />

        <div>
          <h2 className={`text-xl font-bold tracking-tight ${isLight ? 'text-[#1A1A1A]' : 'text-white'}`}>
            Подтверждение записи
          </h2>
          <p className={`text-xs mt-0.5 ${isLight ? 'text-[#5A5A5A]' : 'text-[#A1A3AB]'}`}>
            Проверьте параметры визита и укажите контакт
          </p>
        </div>

        <div
          className={`rounded-2xl p-4 space-y-3 border shadow-sm ${
            isLight
              ? 'border-[#8B6F47]/20 bg-white shadow-md'
              : 'border-[#C5A880]/30 bg-[#16171B]'
          }`}
        >
          <div className={`flex items-center justify-between pb-3 border-b ${isLight ? 'border-black/[0.06]' : 'border-white/[0.06]'}`}>
            <div>
              <div className={`text-[10px] uppercase tracking-wider ${isLight ? 'text-[#5A5A5A]' : 'text-[#A1A3AB]'}`}>
                Выбранная услуга
              </div>
              <div className={`text-sm font-bold ${isLight ? 'text-[#1A1A1A]' : 'text-white'}`}>
                Комплекс «Стрижка + Борода»
              </div>
            </div>
            <span className={`text-sm font-bold tabular-nums ${isLight ? 'text-[#8B6F47]' : 'text-[#C5A880]'}`}>
              10 500 ₸
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className={`text-[10px] block ${isLight ? 'text-[#5A5A5A]' : 'text-[#A1A3AB]'}`}>Мастер:</span>
              <span className={`font-semibold ${isLight ? 'text-[#1A1A1A]' : 'text-white'}`}>Алихан Сарсенов</span>
            </div>
            <div>
              <span className={`text-[10px] block ${isLight ? 'text-[#5A5A5A]' : 'text-[#A1A3AB]'}`}>Дата и время:</span>
              <span className={`font-bold ${isLight ? 'text-[#8B6F47]' : 'text-[#C5A880]'}`}>Чт, 24 окт • 15:30</span>
            </div>
          </div>
        </div>

        <div className="space-y-3 pt-1">
          <div>
            <label className={`text-[11px] font-semibold block mb-1 ${isLight ? 'text-[#5A5A5A]' : 'text-[#A1A3AB]'}`}>
              Ваше имя *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Как к вам обращаться"
              className={`w-full h-11 px-3.5 rounded-xl border text-xs outline-none transition-colors ${
                isLight
                  ? 'border-black/[0.1] bg-white text-[#1A1A1A] focus:border-[#8B6F47] shadow-sm'
                  : 'border-white/[0.08] bg-[#16171B] text-white focus:border-[#C5A880]'
              }`}
            />
          </div>

          <div>
            <label className={`text-[11px] font-semibold block mb-1 ${isLight ? 'text-[#5A5A5A]' : 'text-[#A1A3AB]'}`}>
              Номер телефона (WhatsApp) *
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 (___) ___-__-__"
              className={`w-full h-11 px-3.5 rounded-xl border text-xs outline-none tabular-nums transition-colors ${
                isLight
                  ? 'border-black/[0.1] bg-white text-[#1A1A1A] focus:border-[#8B6F47] shadow-sm'
                  : 'border-white/[0.08] bg-[#16171B] text-white focus:border-[#C5A880]'
              }`}
            />
          </div>
        </div>

        <div
          className={`flex items-center gap-3 p-3.5 rounded-xl border text-[11px] ${
            isLight
              ? 'border-emerald-600/20 bg-emerald-50 text-emerald-900 shadow-sm'
              : 'border-emerald-500/20 bg-emerald-500/[0.04] text-[#A1A3AB]'
          }`}
        >
          <IconShieldCheck className={`w-5 h-5 shrink-0 ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`} />
          <span>
            Оплата в салоне картой или наличными после стрижки. Бесплатная отмена за 2 часа.
          </span>
        </div>
      </div>

      <div
        className={`p-4 border-t ${
          isLight ? 'border-black/[0.06] bg-white' : 'border-white/[0.06] bg-[#16171B]'
        }`}
      >
        <button
          type="button"
          className={`w-full h-12 rounded-2xl font-bold text-sm tracking-wide transition-transform active:scale-[0.98] ${
            isLight
              ? 'bg-[#8B6F47] text-white hover:bg-[#6F5837] shadow-lg shadow-[#8B6F47]/20'
              : 'bg-[#C5A880] text-[#0F1013] shadow-lg shadow-[#C5A880]/20'
          }`}
        >
          Записаться на 24 октября
        </button>
      </div>
    </div>
  );
};

export const Screen6Success: React.FC<{ theme?: PreviewTheme }> = ({ theme = 'dark' }) => {
  const isLight = theme === 'light';

  return (
    <div className="flex-1 flex flex-col justify-between p-4 text-center">
      <div className="pt-6 space-y-4">
        <div
          className={`mx-auto h-20 w-20 rounded-full border-2 flex items-center justify-center animate-bounce duration-1000 ${
            isLight
              ? 'bg-[#8B6F47]/10 border-[#8B6F47] text-[#8B6F47] shadow-[0_0_30px_rgba(139,111,71,0.2)]'
              : 'bg-[#C5A880]/15 border-[#C5A880] text-[#C5A880] shadow-[0_0_35px_rgba(197,168,128,0.3)]'
          }`}
        >
          <IconCheck className="w-10 h-10 stroke-[3]" />
        </div>

        <div>
          <span
            className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
              isLight ? 'text-[#8B6F47]' : 'text-[#C5A880]'
            }`}
          >
            Запись подтверждена • #BK-9482
          </span>
          <h2 className={`text-2xl font-bold tracking-tight mt-1 ${isLight ? 'text-[#1A1A1A]' : 'text-white'}`}>
            Ждём вас в клубе!
          </h2>
          <p className={`text-xs mt-1 max-w-xs mx-auto ${isLight ? 'text-[#5A5A5A]' : 'text-[#A1A3AB]'}`}>
            Подробности визита и ссылка для управления отправлены вам в WhatsApp
          </p>
        </div>

        <div
          className={`rounded-2xl p-4 text-left space-y-3 border ${
            isLight ? 'border-black/[0.06] bg-white shadow-sm' : 'border-white/[0.06] bg-[#16171B]'
          }`}
        >
          <div className={`flex items-center justify-between pb-2.5 border-b ${isLight ? 'border-black/[0.06]' : 'border-white/[0.06]'}`}>
            <span className={`text-xs ${isLight ? 'text-[#5A5A5A]' : 'text-[#A1A3AB]'}`}>Услуга:</span>
            <span className={`text-xs font-semibold ${isLight ? 'text-[#1A1A1A]' : 'text-white'}`}>Комплекс «Стрижка + Борода»</span>
          </div>
          <div className={`flex items-center justify-between pb-2.5 border-b ${isLight ? 'border-black/[0.06]' : 'border-white/[0.06]'}`}>
            <span className={`text-xs ${isLight ? 'text-[#5A5A5A]' : 'text-[#A1A3AB]'}`}>Мастер:</span>
            <span className={`text-xs font-semibold ${isLight ? 'text-[#1A1A1A]' : 'text-white'}`}>Алихан Сарсенов</span>
          </div>
          <div className={`flex items-center justify-between pb-2.5 border-b ${isLight ? 'border-black/[0.06]' : 'border-white/[0.06]'}`}>
            <span className={`text-xs ${isLight ? 'text-[#5A5A5A]' : 'text-[#A1A3AB]'}`}>Время:</span>
            <span className={`text-xs font-bold ${isLight ? 'text-[#8B6F47]' : 'text-[#C5A880]'}`}>24 октября (Чт), 15:30</span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-xs ${isLight ? 'text-[#5A5A5A]' : 'text-[#A1A3AB]'}`}>Локация:</span>
            <span className={`text-xs ${isLight ? 'text-[#1A1A1A]' : 'text-white'}`}>пр. Мангилик Ел, 28</span>
          </div>
        </div>

        <button
          type="button"
          className={`w-full h-11 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors border ${
            isLight
              ? 'border-black/[0.1] bg-white text-[#1A1A1A] hover:bg-black/5 shadow-sm'
              : 'border-white/[0.1] bg-[#1C1E24] text-white hover:bg-white/10'
          }`}
        >
          <IconCalendar className={`w-4 h-4 ${isLight ? 'text-[#8B6F47]' : 'text-[#C5A880]'}`} />
          <span>Добавить в Apple / Google Calendar</span>
        </button>
      </div>

      <div className="pt-4">
        <button
          type="button"
          className={`w-full h-12 rounded-2xl font-bold text-xs tracking-wide transition-transform active:scale-[0.98] ${
            isLight
              ? 'bg-[#8B6F47] text-white hover:bg-[#6F5837] shadow-md'
              : 'bg-[#C5A880] text-[#0F1013]'
          }`}
        >
          Вернуться на главную
        </button>
      </div>
    </div>
  );
};

export const PhoneFrame: React.FC<{
  title: string;
  badgeText: string;
  theme?: PreviewTheme;
  children: React.ReactNode;
}> = ({ title, badgeText, theme = 'dark', children }) => {
  const isLight = theme === 'light';

  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span
            className={`text-[10px] font-bold uppercase tracking-[0.16em] px-2 py-0.5 rounded ${
              isLight
                ? 'bg-[#8B6F47]/10 text-[#8B6F47] border border-[#8B6F47]/20'
                : 'bg-[#C5A880]/15 text-[#C5A880] border border-[#C5A880]/30'
            }`}
          >
            {isLight ? 'Light • Warm Linen' : 'Dark • Luxury'}
          </span>
          <span className="text-[11px] font-semibold text-[#A1A3AB]">({badgeText})</span>
        </div>
        <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
      </div>

      <div
        className={`w-[375px] h-[720px] rounded-[44px] border-[9px] overflow-hidden relative flex flex-col justify-between transition-colors ${
          isLight
            ? 'border-[#26282E] bg-[#FAF8F5] text-[#1A1A1A] shadow-[0_30px_70px_-15px_rgba(0,0,0,0.5)]'
            : 'border-[#1C1D22] bg-[#0F1013] text-[#F5F5F7] shadow-[0_30px_70px_-15px_rgba(0,0,0,0.8)]'
        }`}
      >
        <PhoneStatusBar theme={theme} />
        <div className="flex-1 flex flex-col overflow-y-auto scrollbar-none">
          {children}
        </div>
        <PhoneHomeBar theme={theme} />
      </div>
    </div>
  );
};
