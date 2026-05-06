import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["class"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        midnight: {
          DEFAULT: "#202037",
          50: "#f3f3f7",
          100: "#e1e1ec",
          200: "#c2c3d6",
          300: "#9b9cb8",
          400: "#727496",
          500: "#535679",
          600: "#42445f",
          700: "#34354c",
          800: "#262738",
          900: "#202037",
          950: "#13131f"
        },
        indigoaccent: { DEFAULT: "#5b5fd6", light: "#7c80e8" },
        success: "#16a34a",
        warning: "#f59e0b",
        danger: "#dc2626",
        muted: "#f5f5f9",
        border: "#e4e4ec",
        ring: "#5b5fd6"
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      boxShadow: {
        card: "0 1px 2px rgba(20,20,40,.04), 0 4px 12px rgba(20,20,40,.04)"
      }
    }
  },
  plugins: []
};
export default config;
