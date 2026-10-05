export function formatKzPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (!digits) return '';

  const normalized = digits.startsWith('8') ? '7' + digits.slice(1) : digits.startsWith('7') ? digits : '7' + digits;
  const match = normalized.match(/^(\d{1})(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})$/);
  if (!match) return input;

  let res = '+7';
  if (match[2]) res += ` (${match[2]}`;
  if (match[3]) res += `) ${match[3]}`;
  if (match[4]) res += `-${match[4]}`;
  if (match[5]) res += `-${match[5]}`;
  return res;
}
