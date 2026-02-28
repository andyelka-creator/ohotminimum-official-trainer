import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { OfficialBankSchema, type OfficialBank } from "./schema.js";
import { sha256 } from "./hash.js";

const DATA_DIR = path.resolve(process.cwd(), "data");
const BANK_PATH = path.join(DATA_DIR, "official_bank.json");
const HASH_PATH = path.join(DATA_DIR, "official_bank.hash");

export type StoreState =
  | { ready: true; bank: OfficialBank; hash: string }
  | { ready: false; reason: string };

export function loadOfficialStore(): StoreState {
  if (!existsSync(BANK_PATH) || !existsSync(HASH_PATH)) {
    return { ready: false, reason: "SYSTEM NOT READY" };
  }

  let raw = "";
  let expectedHash = "";
  try {
    raw = readFileSync(BANK_PATH, "utf8");
    expectedHash = readFileSync(HASH_PATH, "utf8").trim();
  } catch {
    return { ready: false, reason: "SYSTEM NOT READY" };
  }

  const actualHash = sha256(raw);
  if (!expectedHash || actualHash !== expectedHash) {
    return { ready: false, reason: "SYSTEM NOT READY" };
  }

  try {
    const parsed = JSON.parse(raw);
    const validated = OfficialBankSchema.parse(parsed);
    return { ready: true, bank: validated, hash: expectedHash };
  } catch {
    return { ready: false, reason: "SYSTEM NOT READY" };
  }
}
