import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      colors: {
        brand: {
          ink: "rgb(var(--color-brand-ink) / <alpha-value>)",
          surface: "rgb(var(--color-brand-surface) / <alpha-value>)",
          accent: "rgb(var(--color-brand-accent) / <alpha-value>)",
          blue: "#153f70",
          green: "#60e8c1"
        }
      },
      fontFamily: {
        sans: ["Poppins", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
} satisfies Config;
