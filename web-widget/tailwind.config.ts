import type { Config } from 'tailwindcss';

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
      },
    },
  },
  plugins: [],
};

export default config;
