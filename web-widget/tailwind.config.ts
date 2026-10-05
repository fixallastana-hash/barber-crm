import type { Config } from 'tailwindcss';
import defaultTheme from 'tailwindcss/defaultTheme';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--widget-primary)',
          hover: 'var(--widget-primary-hover)',
        },
        ink: 'var(--widget-ink)',
        surface: 'var(--widget-surface)',
        card: 'var(--widget-card)',
        line: 'var(--widget-line)',
        muted: 'var(--widget-muted)',
        success: 'var(--widget-success)',
        danger: 'var(--widget-danger)',
        accent: {
          DEFAULT: 'var(--accent)',
          hover: 'var(--accent-hover)',
        },
      },
      fontFamily: {
        sans: ['Manrope', 'var(--font-inter)', ...defaultTheme.fontFamily.sans],
        heading: ['Syne', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
};

export default config;
