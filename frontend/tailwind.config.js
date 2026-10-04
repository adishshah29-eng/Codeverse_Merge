/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        mint: {
          dark: '#0a0d14',
          surface: '#111726',
          card: '#161f33',
          border: '#23304d',
          gold: '#d4af37',
          goldhover: '#b89628',
          red: '#e50914',
          crimson: '#9b111e',
          accent: '#00e5ff'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
        display: ['Impact', 'Arial Black', 'sans-serif'],
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { opacity: '0.9', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(0.98)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(1000%)' },
        }
      },
      animation: {
        glow: 'pulseGlow 2.5s infinite ease-in-out',
        scan: 'scanline 8s linear infinite',
      }
    },
  },
  plugins: [],
}
