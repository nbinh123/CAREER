/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#221B14",
          soft: "#332A1F",
        },
        paper: {
          DEFAULT: "#FBF6EC",
          dim: "#F1EADA",
        },
        chili: {
          DEFAULT: "#D6361F",
          dark: "#B32B18",
          light: "#F0E1DB",
        },
        turmeric: {
          DEFAULT: "#E8A93E",
          dark: "#C98A24",
          light: "#FBEED2",
        },
        jade: {
          DEFAULT: "#2E6F55",
          light: "#DCEBE3",
        },
        steel: {
          DEFAULT: "#7A7267",
          light: "#B9B2A4",
        },
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      borderRadius: {
        ticket: "18px",
      },
      boxShadow: {
        ticket: "0 8px 24px -8px rgba(34, 27, 20, 0.25)",
        float: "0 -4px 20px -4px rgba(34, 27, 20, 0.18)",
      },
      keyframes: {
        "slide-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.3" },
        },
      },
      animation: {
        "slide-up": "slide-up 0.28s ease-out",
        "fade-in": "fade-in 0.2s ease-out",
        "pulse-dot": "pulse-dot 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
