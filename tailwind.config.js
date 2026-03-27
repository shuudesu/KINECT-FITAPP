/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        kinetic: {
          black: '#000000',
          white: '#FFFFFF',
          neon: '#CCFF00',
          dark: '#111111',
          gray: '#333333'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['"Oswald"', 'sans-serif'], // Alternative: sync this with Google Fonts later
      }
    },
  },
  plugins: [],
}
