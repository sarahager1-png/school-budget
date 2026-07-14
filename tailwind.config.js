/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // זהות רשת חינוך חב"ד: טורקיז #00B4CC + סגול #4B2E83
        teal: {
          50: '#E5F8FB',
          100: '#C2EFF5',
          200: '#8FE3EE',
          300: '#5CD5E5',
          400: '#2EC7DB',
          500: '#00B4CC',
          600: '#0090A8',
          700: '#007487',
          800: '#005766',
          900: '#003B45',
        },
        purple: {
          50: '#F0EDF8',
          100: '#E2DCF0',
          200: '#C9BDE4',
          300: '#A794D0',
          400: '#7A5FB0',
          500: '#4B2E83',
          600: '#3D2570',
          700: '#301C5B',
          800: '#241546',
          900: '#1A0B35',
        },
        coral: {
          50: '#FFF0E6',
          100: '#FFD9BC',
          200: '#FFC090',
          300: '#FFA766',
          400: '#FF9245',
          500: '#F07A20',
          600: '#D4661A',
          700: '#B85215',
          800: '#9C3F10',
          900: '#7A300C',
        },
        gold: {
          50: '#FFFBE6',
          100: '#FFF5BF',
          200: '#FFED96',
          300: '#FFE56D',
          400: '#FFDC4A',
          500: '#F5C518',
          600: '#D4A614',
          700: '#B38710',
          800: '#916A0C',
          900: '#6F5009',
        },
      },
      fontFamily: {
        sans: ['Heebo', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
