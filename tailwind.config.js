/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./src/**/*.{js,jsx,ts,tsx}"],
    theme: {
      extend: {
        backgroundImage: {
          'radial-gradient': 'radial-gradient(ellipse at 75% 25%, #f3eaff 0%, #b6b6f6 40%, #5a7fdc 70%, #1a2a5c 100%)',
        }
      },
    },
    plugins: [],
  };