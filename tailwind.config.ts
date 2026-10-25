import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#101827",
        navy: "#142d4e",
        mint: "#b9f4d6",
        paper: "#f7f8fa"
      },
      boxShadow: {
        soft: "0 12px 36px rgba(18, 36, 58, .08)"
      }
    }
  },
  plugins: []
};

export default config;
