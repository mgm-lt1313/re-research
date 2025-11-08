/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    // Broaden scanning to cover all source files in the project so Tailwind
    // doesn't accidentally purge classes used by pages or nested folders.
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};