import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#173B55",
        sky: "#2A6384",
        mint: "#86C9AA",
        canvas: "#F3F5F7"
      },
      boxShadow: {
        soft: "0 18px 50px -28px rgba(23, 59, 85, 0.35)"
      }
    }
  },
  plugins: []
};

export default config;
