import { HtmlBasePlugin } from "@11ty/eleventy";
import yaml from "js-yaml";

// Website (Marketing-Seiten) - die App unter app/ ist ein eigenständiger
// Vite-Build und wird im Gesamt-Build nach dist/app/ gelegt (siehe
// package.json "build"). Eleventy fasst app/ nicht an.
export default function (eleventyConfig) {
  // Alle internen Links werden als "/pfad/" geschrieben; das Plugin setzt
  // beim Build den pathPrefix davor. Umzug auf eine eigene Domain (z.B.
  // divrebound.de) = pathPrefix auf "/" setzen, sonst nichts.
  eleventyConfig.addPlugin(HtmlBasePlugin);

  eleventyConfig.addDataExtension("yml", (contents) => yaml.load(contents));

  eleventyConfig.addPassthroughCopy({ "site/assets": "assets" });
  // Design-Tokens und Fonts haben genau eine Quelle: die App. Die Website
  // bekommt beim Build eine Kopie, damit beide nicht auseinanderlaufen.
  eleventyConfig.addPassthroughCopy({
    "app/src/style/tokens.css": "assets/css/tokens.css",
    "app/src/style/fonts": "assets/css/fonts",
  });

  // 27.5 -> "27,5 %"
  eleventyConfig.addFilter("pct", (value) => `${String(value).replace(".", ",")} %`);
  eleventyConfig.addFilter("sortByPotential", (countries) =>
    [...countries].sort((a, b) => b.potential - a.potential)
  );
  eleventyConfig.addFilter("withCompanies", (countries) => countries.filter((c) => c.companies));
  eleventyConfig.addFilter("potentialFor", (countries, code) => {
    const c = countries.find((x) => x.code === code);
    return c ? `bis zu ${String(c.potential).replace(".", ",")} %` : "";
  });

  return {
    dir: { input: "site", output: "dist" },
    pathPrefix: "/DivRebound/",
    markdownTemplateEngine: "liquid",
    htmlTemplateEngine: "liquid",
  };
}
