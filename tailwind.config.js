/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        githubDark: "#242938",
      },
      boxShadow: {
        homeShadow: "0 0 2px 2px grey",
      },
    },
  },
  plugins: [],
};
