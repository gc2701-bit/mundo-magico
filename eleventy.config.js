const fs = require("fs");
const path = require("path");

module.exports = function (eleventyConfig) {
  // Los .pcard/.catsec en el HTML fuente los siguen leyendo con regex
  // .claude/gen-explorar-data.js y gen-subcategorias-html.js — por eso el
  // fuente de Eleventy es la RAÍZ del repo (los mismos *.html de siempre),
  // no una carpeta /src separada. Ver SPEC.md, sección 4.
  eleventyConfig.setUseGitIgnore(false);

  // Eleventy NO limpia _site/ entre builds — un archivo que ya no tiene
  // fuente (ej. una página borrada, un asset viejo) se queda ahí para
  // siempre y un `npm run test:e2e` local puede pasar en falso contra un
  // build stale (encontrado por el agente de test-engineer, confirmado
  // empíricamente). Empezar cada build en limpio.
  eleventyConfig.on("eleventy.before", async () => {
    const outDir = path.join(__dirname, "_site");
    if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
  });

  // assets/Logo/"Header categories"/productos viven en public/ desde el
  // Sprint 2 (ver plan) — Next.js los sirve tal cual en la misma URL
  // (public/assets/x → /assets/x), y el build de Eleventy (mientras
  // conviva con el sitio viejo, hasta el Sprint 7) los sigue copiando a
  // los mismos nombres de siempre en _site/, sólo cambia de dónde los lee.
  eleventyConfig.addPassthroughCopy({ "public/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "public/Logo": "Logo" });
  eleventyConfig.addPassthroughCopy({ "public/Header categories": "Header categories" });
  eleventyConfig.addPassthroughCopy({ "public/_headers": "_headers" });
  eleventyConfig.addPassthroughCopy({ "public/_redirects": "_redirects" });
  eleventyConfig.addPassthroughCopy({ "public/productos": "productos" });

  // productos/Mejor calidad/ (48MB de los 94MB de productos/) no la referencia
  // ningún HTML del sitio, solo .claude/replace-quality.js (herramienta local
  // de un solo uso) — no tiene sentido publicarla. addPassthroughCopy no
  // soporta excluir una subcarpeta puntual, así que se borra del output
  // después de copiar.
  eleventyConfig.on("eleventy.after", async () => {
    const dir = path.join(__dirname, "_site", "productos", "Mejor calidad");
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  });

  eleventyConfig.setServerPassthroughCopyBehavior("passthrough");

  return {
    dir: {
      input: ".",
      includes: "_includes",
      output: "_site"
    },
    htmlTemplateEngine: "njk",
    templateFormats: ["html", "njk"]
  };
};
