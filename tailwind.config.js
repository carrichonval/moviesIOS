const { hairlineWidth } = require('nativewind/theme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#000000',
        surface: '#1C1C1E',
        'surface-elevated': '#2C2C2E',
        'surface-muted': '#242426',
        border: {
          DEFAULT: '#38383A',
          subtle: '#2A2A2C',
        },
        content: {
          primary: '#FFFFFF',
          secondary: '#EBEBF599',
          tertiary: '#EBEBF54D',
        },
        accent: {
          DEFAULT: '#0A84FF',
          light: '#409CFF',
        },
        danger: '#FF453A',
        warning: '#FF9F0A',
        success: '#30D158',
        info: '#0A84FF',
      },
      borderRadius: {
        card: '20px',
        sheet: '28px',
      },
      borderWidth: {
        hairline: hairlineWidth(),
      },
    },
  },
  plugins: [],
};
