import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        unicorn: {
          purple: '#1a0533',
          violet: '#4a0e8f',
          pink: '#e040fb',
          cyan: '#00e5ff',
          gold: '#ffd700',
        }
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
      }
    }
  },
  plugins: []
} satisfies Config
