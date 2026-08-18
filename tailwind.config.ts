import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Escala neutra quente — base do sistema
        ink: {
          950: '#0C0C0C',
          900: '#171717',
          800: '#262626',
          700: '#404040',
          600: '#525252',
          500: '#737373',
          400: '#A3A3A3',
          300: '#D4D4D4',
          200: '#E5E5E5',
          100: '#F0F0EF',
          50: '#FAFAFA',
        },
        // Acento institucional (petroleo profundo) — usado com parcimonia
        petrol: {
          900: '#0B2E28',
          800: '#0F3B33',
          700: '#14544A',
          600: '#1A6A5D',
          100: '#E6F0EE',
        },
        positive: { 700: '#15803D', 600: '#16A34A', 100: '#DCFCE7' },
        caution: { 700: '#A16207', 600: '#CA8A04', 100: '#FEF9C3' },
        critical: { 700: '#B91C1C', 600: '#DC2626', 100: '#FEE2E2' },
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      fontSize: {
        '2xs': ['11px', { lineHeight: '16px', letterSpacing: '0.01em' }],
        xs: ['12px', { lineHeight: '18px' }],
        sm: ['13px', { lineHeight: '20px' }],
        base: ['14px', { lineHeight: '22px' }],
        md: ['15px', { lineHeight: '24px' }],
      },
      borderRadius: { DEFAULT: '6px', md: '6px', lg: '8px', xl: '10px' },
      boxShadow: {
        subtle: '0 1px 2px rgba(0,0,0,0.04)',
        panel: '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.03)',
        pop: '0 8px 24px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05)',
      },
    },
  },
  plugins: [],
}
export default config
