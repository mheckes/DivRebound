import { defineConfig } from "vite";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

// App-Version für das Beta-Feedback: "0.1.0 · a611c47 · 01.11.2026".
// Commit aus GitHub Actions (GITHUB_SHA) oder lokal aus git; der Build-Spiegel
// unter .dev-cache hat kein .git, dort steht "dev".
function appVersion() {
  const { version } = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
  let commit = process.env.GITHUB_SHA?.slice(0, 7);
  if (!commit) {
    try {
      commit = execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    } catch {
      commit = "dev";
    }
  }
  const date = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${version} · ${commit} · ${date}`;
}

export default defineConfig({
  // Die App liegt unter /app/, die Website unter / (divrebound.com)
  // (Gesamt-Build siehe package.json im Repo-Root).
  base: "/app/",
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  server: {
    // Erlaubt den Import von site/_data/nav.json (gemeinsame Link-Quelle
    // für Website und App) außerhalb von app/.
    fs: { allow: [".."] },
  },
});
