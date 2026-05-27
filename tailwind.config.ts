import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    borderRadius: {
      none: "0",
      sm: "2px",
      DEFAULT: "2px",
      md: "3px",
      lg: "4px",
      full: "9999px"
    },
    extend: {
      colors: {
        canvas: "#f6f2ea",
        surface: "#fffdf8",
        ink: {
          DEFAULT: "#101517",
          muted: "#475255",
          faint: "#748083",
          inverse: "#f7f4ec"
        },
        rule: {
          DEFAULT: "#ddd5c6",
          muted: "#ebe5d8",
          strong: "#223235"
        },
        accent: {
          DEFAULT: "#176f7d",
          ink: "#073941",
          mist: "#e6f0ef",
          soft: "#c9dedc",
          warm: "#b4874c"
        },
        night: {
          DEFAULT: "#071f24",
          soft: "#0d3036",
          muted: "#24474d"
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"]
      },
      maxWidth: {
        page: "1280px"
      },
      letterSpacing: {
        display: "0",
        label: "0.14em"
      }
    }
  },
  plugins: []
};

export default config;
