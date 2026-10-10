import { defineConfig } from "vite";

export default defineConfig({
  // Die App liegt unter /DivRebound/app/, die Website unter /DivRebound/
  // (Gesamt-Build siehe package.json im Repo-Root).
  base: "/DivRebound/app/",
  server: {
    // Erlaubt den Import von site/_data/nav.json (gemeinsame Link-Quelle
    // für Website und App) außerhalb von app/.
    fs: { allow: [".."] },
  },
});
