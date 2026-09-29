import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        widget: {
          primary: '#F4C842',
          black: '#1A1A1A',
          surface: '#FAFAFA',
          border: '#E5E5E5',
          muted: '#7A7A7A',
          success: '#15803D',
          danger: '#DC2626',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

export default config;