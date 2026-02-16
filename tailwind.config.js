/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'stacks-purple': '#5546FF',
        'stacks-dark': '#0C0C0D',
        'bitcoin-orange': '#F7931A',
      },
    },
  },
  plugins: [],
}
