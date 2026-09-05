import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["class"],
  theme: {
    container: { center: true, padding: "1rem", screens: { "2xl": "1400px" } },
    extend: {
      colors: {
        // Palette officielle Dasolabs (charte graphique)
        stellar:  "#07070D",     // stellar black — accents ultra-sombres
        midnight: {
          DEFAULT: "#202037",    // midnight indigo — fond sombre principal
          50:  "#f1f1f6",        // silver comet
          100: "#e5e5ee",
          200: "#c8c9d5",
          300: "#9394a6",
          400: "#6b6d80",
          500: "#4a4d6a",
          600: "#3a3d5a",
          700: "#2d2f4a",
          800: "#252740",
          900: "#202037",
          950: "#07070D"
        },
        // Electric blue — l'accent signature de la charte
        indigoaccent: { DEFAULT: "#3434E8", light: "#6b6bf0" },
        electric: "#3434E8",
        silver: "#F1F1F6",       // silver comet
        success: "#10B981",
        warning: "#F59E0B",
        danger:  "#EF4444",
        muted:   "#F1F1F6",
        border:  "#e5e5ee",
        ring:    "#3434E8"
      },
      fontFamily: {
        // DM Sans injectée depuis layout.tsx via next/font
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"]
      },
      borderRadius: {
        lg: "10px",
        xl: "12px",
        "2xl": "16px"
      },
      boxShadow: {
        card: "0 1px 2px rgba(7,7,13,.04), 0 4px 16px rgba(7,7,13,.05)",
        cardHover: "0 8px 30px rgba(52,52,232,.12)",
        pop: "0 12px 40px rgba(52,52,232,.18)"
      }
    }
  },
  plugins: []
};
export default config;
