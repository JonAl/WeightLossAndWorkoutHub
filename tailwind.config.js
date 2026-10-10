/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: { 50: '#eef2f8', 100: '#d5deec', 200: '#a9bad6', 300: '#7a92ba', 400: '#4f6b98', 500: '#344e78', 600: '#243a5e', 700: '#1a2b48', 800: '#122036', 900: '#0b1324', 950: '#070c18' },
        teal: { 50: '#ecfdf9', 100: '#cff8ee', 200: '#a2efdd', 300: '#67dfc8', 400: '#2fc6ad', 500: '#14a994', 600: '#0d8878', 700: '#0f6d62', 800: '#11574f', 900: '#124842' }
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'Noto Sans', 'sans-serif'] },
      keyframes: { 'fade-in': { from: { opacity: 0, transform: 'translateY(4px)' }, to: { opacity: 1, transform: 'none' } } },
      animation: { 'fade-in': 'fade-in .2s ease-out' }
    }
  },
  plugins: []
};
