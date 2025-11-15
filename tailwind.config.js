// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    // './styles/globals.css', // 👈 この行を追加
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};