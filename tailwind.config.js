/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        poly: {
          bg: '#0c0e1a',
          card: '#13162d',
          border: '#2a2d4a',
          hover: '#1e2244',
        },
      },
    },
  },
  plugins: [],
}
