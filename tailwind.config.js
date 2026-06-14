/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark rock/metal palette — deep blacks with an electric ember accent.
        ink: {
          950: '#08080a',
          900: '#0d0d11',
          850: '#121218',
          800: '#17171f',
          750: '#1d1d27',
          700: '#24242f',
          600: '#33333f',
        },
        ember: {
          DEFAULT: '#ff5c2b',
          50: '#fff1ec',
          100: '#ffd9cc',
          300: '#ff8a63',
          400: '#ff6f42',
          500: '#ff5c2b',
          600: '#e8430f',
          700: '#bd3309',
        },
        amp: {
          // secondary accent — amplifier teal/cyan
          DEFAULT: '#2bd6ff',
          400: '#5ce0ff',
          500: '#2bd6ff',
          600: '#0fb8e8',
        },
        signal: {
          green: '#3ddc84',
          amber: '#ffc043',
          red: '#ff4d4d',
        },
      },
      fontFamily: {
        display: ['"Oswald"', 'system-ui', 'sans-serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        ember: '0 0 0 1px rgba(255,92,43,0.4), 0 8px 30px -8px rgba(255,92,43,0.5)',
        glow: '0 0 24px -4px rgba(255,92,43,0.55)',
        card: '0 10px 40px -16px rgba(0,0,0,0.8)',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.95)', opacity: '0.7' },
          '70%': { transform: 'scale(1.3)', opacity: '0' },
          '100%': { transform: 'scale(1.3)', opacity: '0' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.215,0.61,0.355,1) infinite',
        'slide-up': 'slide-up 0.35s ease-out both',
        'fade-in': 'fade-in 0.3s ease-out both',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
};
