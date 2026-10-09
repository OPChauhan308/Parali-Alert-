/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Newsreader', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        paper: {
          DEFAULT: '#F6F5F0',
          pure: '#FFFFFF',
          warm: '#EFECE4',
          linen: '#E7E3D8',
        },
        ink: {
          DEFAULT: '#181816',
          secondary: '#4A473F',
          muted: '#767267',
          faint: '#A49F93',
        },
        rule: {
          hairline: '#DCD7CC',
          strong: '#181816',
          subtle: '#EAE6DC',
        },
        terracotta: {
          50: '#FEF2F2',
          100: '#FEE2E2',
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
        },
        ochre: {
          50: '#FFFBEB',
          100: '#FEF3C7',
          600: '#D97706',
          700: '#B45309',
          800: '#92400E',
        },
        sage: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          600: '#16A34A',
          700: '#15803D',
          800: '#166534',
        }
      }
    },
  },
  plugins: [],
}
