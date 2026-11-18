import type { Config } from "tailwindcss";
import colors from "tailwindcss/colors";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))"
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))"
        },
        ink: "#0f172a",
        navy: "#0f172a",
        panel: "#101722",
        brand: "#23675D",
        electric: "#8FB8D4",
        sky: {
          50: "#f4faf8",
          100: "#EAF2F8",
          200: "#c6ddd8",
          300: "#8FB8D4",
          400: "#789ca3",
          500: "#5E7681",
          600: "#36556F",
          700: "#2A6384",
          800: "#214E69",
          900: "#13112D",
          950: "#0b0a1b",
          DEFAULT: "#2A6384"
        },
        success: "#2563eb",
        warning: "#f59e0b"
      },
      fontFamily: {
        display: ["var(--font-display)", "var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)"
      },
      transitionTimingFunction: {
        DEFAULT: "cubic-bezier(0.22, 1, 0.36, 1)"
      },
      transitionDuration: {
        DEFAULT: "240ms"
      },
      boxShadow: {
        soft: "0 1px 2px rgba(17, 26, 36, 0.06), 0 6px 16px -8px rgba(17, 26, 36, 0.22)",
        glow: "0 2px 6px rgba(17, 26, 36, 0.1), 0 14px 30px -12px rgba(42, 99, 132, 0.45)",
        strong: "0 2px 4px rgba(17, 26, 36, 0.08), 0 20px 40px -16px rgba(17, 26, 36, 0.38)"
      }
    }
  },
  plugins: [tailwindcssAnimate]
};

export default config;
