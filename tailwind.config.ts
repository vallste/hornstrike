import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        unicorn: {
          purple: '#1a0533',
          // theme-abhängig: dunkles Violett im Dark, helleres im Light (Glows/Flächen)
          violet: 'rgb(var(--u-violet) / <alpha-value>)',
          pink: '#e040fb',
          cyan: '#00e5ff',
          gold: '#ffd700',
        },
        // Semantische Tokens (theme-abhängig via CSS-Variablen, alpha-fähig)
        app: 'rgb(var(--app) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        surface2: 'rgb(var(--surface2) / <alpha-value>)',
        fg: 'rgb(var(--fg) / <alpha-value>)',
        // Lesbare Akzent-Töne für Text/Rahmen (Neon im Dark, gedeckt im Light)
        'accent-pink': 'rgb(var(--accent-pink) / <alpha-value>)',
        'accent-cyan': 'rgb(var(--accent-cyan) / <alpha-value>)',
        'accent-gold': 'rgb(var(--accent-gold) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Outfit', 'system-ui', 'sans-serif'],
      }
    }
  },
  plugins: []
} satisfies Config
