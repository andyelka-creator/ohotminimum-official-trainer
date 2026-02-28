import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { OfficialBankSchema } from "../src/schema.js";
import { sha256 } from "../src/hash.js";

const cwd = process.cwd();
const bankPath = path.join(cwd, "data", "official_bank.json");
const hashPath = path.join(cwd, "data", "official_bank.hash");
const versionsPath = path.join(cwd, "data", "official_versions.json");

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

if (!existsSync(bankPath) || !existsSync(hashPath)) {
  fail("SYSTEM NOT READY: missing official_bank.json or official_bank.hash");
}

const raw = readFileSync(bankPath, "utf8");
const expectedHash = readFileSync(hashPath, "utf8").trim();
const actualHash = sha256(raw);

if (actualHash !== expectedHash) {
  fail(`Hash mismatch: ${actualHash} != ${expectedHash}`);
}

try {
  const parsed = JSON.parse(raw);
  OfficialBankSchema.parse(parsed);
} catch (err) {
  fail(`Schema validation failed: ${err instanceof Error ? err.message : String(err)}`);
}

if (!existsSync(versionsPath)) {
  fail("Missing data/official_versions.json");
}

const versionsRaw = readFileSync(versionsPath, "utf8");
try {
  const versions = JSON.parse(versionsRaw);
  if (!Array.isArray(versions)) {
    fail("official_versions.json must be an array");
  }
} catch (err) {
  fail(`Invalid official_versions.json: ${err instanceof Error ? err.message : String(err)}`);
}

console.log("Integrity check passed.");
