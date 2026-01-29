/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        sorti: {
          primary: '#1a365d',
          secondary: '#2d3748',
          accent: '#ed8936',
          success: '#48bb78',
          error: '#f56565',
          warning: '#ecc94b',
        },
      },
      animation: {
        'bounce-slow': 'bounce 1.5s infinite',
        'pulse-fast': 'pulse 1s infinite',
      },
    },
  },
  plugins: [],
};
