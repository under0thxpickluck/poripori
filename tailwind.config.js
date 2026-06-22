/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0E1117',
        surface: '#1A1D29',
        'surface-hover': '#222632',
        border: '#222632',
        accent: '#2D9CDB',
        'accent-hover': '#2589C4',
        yes: '#27AE60',
        no: '#EB5757',
        text: '#E6E8EC',
        'text-muted': '#8A8F98',
      },
      borderRadius: {
        lg: '8px',
        md: '6px',
      },
    },
  },
  plugins: [],
}
