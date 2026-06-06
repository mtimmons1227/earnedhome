import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // tenant theme is driven by CSS variables set per-request
        brand: "var(--primary)",
        accent: "var(--accent)",
        page: "var(--bg)",
      },
    },
  },
  plugins: [],
};
export default config;
