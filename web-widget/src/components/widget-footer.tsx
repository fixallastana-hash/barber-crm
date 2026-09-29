const WHATSAPP_URL = 'https://wa.me/77079632034';

export function WidgetFooter() {
  return (
    <footer className="w-full py-6 text-center">
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-muted transition-colors hover:text-ink"
      >
        Сотрудничество
      </a>
    </footer>
  );
}