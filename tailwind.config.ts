import type { Config } from "tailwindcss";

// Colours that change with the theme read a CSS variable (see globals.css), so the components
// keep their plain slate/white classes and need no dark: variants.
const themed = (name: string, shades: number[]) =>
  Object.fromEntries(
    shades.map((s) => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`])
  );

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        slate: themed(
          "slate",
          [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
        ),
        emerald: themed("emerald", [50, 200, 700, 800]),
        amber: themed("amber", [50, 100, 200, 700, 800]),
        indigo: themed("indigo", [50, 200]),
      },
      backgroundColor: { white: "rgb(var(--surface) / <alpha-value>)" },
    },
  },
  plugins: [],
};

export default config;
