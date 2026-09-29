const WHATSAPP_URL = 'https://wa.me/77079632034';

export function WidgetFooter() {
  return (
    <footer className="w-full py-4 text-center">
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center px-4 py-3 text-sm text-muted transition-colors hover:text-ink"
      >
        Сотрудничество
      </a>
    </footer>
  );
}