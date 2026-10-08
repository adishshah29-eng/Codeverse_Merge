/** @type {import('tailwindcss').Config} */

// Phase 1 design tokens — closed palette: black, red, beige, white. See docs/UI_REVISION_PLAN.md.
const red = { DEFAULT: "#D2362B", hover: "#B22B21", text: "#F0624F", tint: "#3A1512", deep: "#2A0F0D" };
const beige = { DEFAULT: "#E9DFCB", dim: "#A89A88", faint: "#7A6D60", deep: "#D4C8B2" };

// The Royal Mint screens were written with Tailwind's stock colour names; those names are remapped onto the palette so
// the screens pick the new look up without a rewrite. Status hues collapse to red (bad / act) or beige (good / info).
const warm = {          // greys → warm beige-greys on black
  50: "#FBF7EE", 100: "#F5EFE3", 200: "#E9DFCB", 300: "#D4C8B2", 400: "#A89A88",
  500: "#7A6D60", 600: "#5C5148", 700: "#3A312B", 800: "#241E1A", 900: "#161210", 950: "#0D0B0A",
};
const good = {          // "success" hues → beige
  50: "#FBF7EE", 100: "#F5EFE3", 200: "#E9DFCB", 300: "#E9DFCB", 400: "#E9DFCB", 500: "#D4C8B2",
  600: "#A89A88", 700: "#7A6D60", 800: "#3A312B", 900: "#2A241F", 950: "#1F1A17",
};
const bad = {           // "error / warn" hues → red
  50: "#FBE9E6", 100: "#F6D2CC", 200: "#F0A89F", 300: "#F0624F", 400: "#F0624F", 500: "#D2362B",
  600: "#B22B21", 700: "#8F2019", 800: "#5A1A15", 900: "#3A1512", 950: "#2A0F0D",
};
const info = {          // everything else (cyan, blue, purple…) → neutral beige
  50: "#FBF7EE", 100: "#F5EFE3", 200: "#E9DFCB", 300: "#D4C8B2", 400: "#D4C8B2", 500: "#A89A88",
  600: "#7A6D60", 700: "#5C5148", 800: "#3A312B", 900: "#2A241F", 950: "#1F1A17",
};

export default {
  // Tailwind is used by Phase 1 only; its CSS is loaded only on /phase1/.
  content: ["./phase1/index.html", "./src/phase1/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      white: "#FFFFFF",
      black: "#0D0B0A",
      ink: "#0D0B0A",          // page
      coal: { DEFAULT: "#161210", 2: "#1F1A17", well: "#0A0807" },   // cards, raised, wells/inputs
      rule: "#352D27",
      red,
      beige,
      gray: warm, slate: warm, zinc: warm, neutral: warm, stone: warm,
      emerald: good, green: good, teal: good, lime: good,
      rose: bad, orange: bad, amber: bad, yellow: bad,
      cyan: info, sky: info, blue: info, indigo: info, purple: info, violet: info, fuchsia: info, pink: info,
    },
    borderRadius: {
      none: "0", sm: "2px", DEFAULT: "3px", md: "3px", lg: "4px", xl: "4px", "2xl": "4px", "3xl": "6px", full: "9999px",
    },
    fontFamily: {
      sans: ['"Public Sans"', "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      display: ['"Fraunces"', "Georgia", "serif"],
      mono: ['"JetBrains Mono"', "ui-monospace", "Menlo", "Consolas", "monospace"],
    },
    extend: {
      keyframes: { rise: { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "none" } } },
      animation: { rise: "rise .18s ease-out both" },
    },
  },
  plugins: [],
};
