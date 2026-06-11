/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#fdf2f4',
          100: '#fce7ea',
          200: '#f9d0d6',
          300: '#f4a8b3',
          400: '#ed7587',
          500: '#e0455d',
          600: '#c7253f',
          700: '#a31b32',
          800: '#891a2e',
          900: '#6b1525',
        }
      }
    },
  },
  plugins: [],
}