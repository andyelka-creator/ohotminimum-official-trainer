import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "dist-pages");
const publicDir = path.join(root, "public");
const dataDir = path.join(root, "data");
const pagesDataDir = path.join(outDir, "data");
const buildMetaPath = path.join(outDir, "build-meta.json");

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

cpSync(publicDir, outDir, { recursive: true });
mkdirSync(pagesDataDir, { recursive: true });

for (const file of ["official_bank.json", "official_bank.hash", "official_versions.json"]) {
  const src = path.join(dataDir, file);
  if (existsSync(src)) {
    cpSync(src, path.join(pagesDataDir, file));
  }
}

const indexPath = path.join(outDir, "index.html");
if (existsSync(indexPath)) {
  const buildTime = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Moscow",
  }).format(new Date());
  const html = readFileSync(indexPath, "utf8").replace(/__BUILD_HHMM__/g, buildTime);
  writeFileSync(indexPath, html, "utf8");
}

const buildNow = new Date();
const buildTimeMoscow = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Europe/Moscow",
}).format(buildNow);
const buildMeta = {
  buildId: String(buildNow.getTime()),
  buildTime: buildTimeMoscow,
  builtAtIso: buildNow.toISOString(),
};
writeFileSync(buildMetaPath, `${JSON.stringify(buildMeta, null, 2)}\n`, "utf8");

writeFileSync(path.join(outDir, ".nojekyll"), "\n", "utf8");
console.log("dist-pages prepared");
