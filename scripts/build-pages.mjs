import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "dist-pages");
const publicDir = path.join(root, "public");
const dataDir = path.join(root, "data");
const pagesDataDir = path.join(outDir, "data");

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

writeFileSync(path.join(outDir, ".nojekyll"), "\n", "utf8");
console.log("dist-pages prepared");
