import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#0E160E",
        foreground: "#FDFFF7",
        primary: {
          DEFAULT: "#D2F38A",
          foreground: "#0E160E",
        },
        "plug-green": "#385842",
        "plug-yellow": "#D2F38A",
        green: "#92F38A",
        red: "#F3908A",
        orange: "#F3B08A",
        yellow: "#F3EF8A",
        purple: "#9F8AF3",
        blue: "#8AAEF3",
        cyan: "#8AF3E6",
        "chart-green": "#B2E986",
      },
      borderRadius: {
        xs: "4px",
        sm: "8px",
        md: "10px",
        lg: "16px",
        xl: "24px",
      },
      fontFamily: {
        sans: [
          "Satoshi",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};

export default config;
