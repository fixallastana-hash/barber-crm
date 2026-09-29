'use client';

const WHATSAPP_URL = 'https://wa.me/77079632034';

export function WidgetFooter() {
  return (
    <footer className="w-full py-6 text-center">
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] text-[#7A7A7A] transition-colors duration-150 hover:text-[#1A1A1A]"
      >
        Сотрудничество
      </a>
    </footer>
  );
}

export default WidgetFooter;