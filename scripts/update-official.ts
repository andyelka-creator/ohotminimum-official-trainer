import { createWriteStream, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { spawnSync } from "node:child_process";
import pdf from "pdf-parse";
import { z } from "zod";
import { OfficialBankSchema, type OfficialBank, type OfficialQuestion } from "../src/schema.js";
import { sha256 } from "../src/hash.js";

type SourceConfig = {
  sourceType: "pdf";
  url: string;
  fallbackUrls: string[];
  expectedQuestionCount: number;
  checkIntervalHours: number;
  timeoutMs: number;
};

type ParsedResult = {
  questions: OfficialQuestion[];
  confidence: number;
};

type DiffSummary = {
  added: number;
  removed: number;
  changed: number;
};

const sourceConfigSchema = z.object({
  sourceType: z.literal("pdf"),
  url: z.string().url(),
  fallbackUrls: z.array(z.string().url()),
  expectedQuestionCount: z.literal(257),
  checkIntervalHours: z.number().int().positive(),
  timeoutMs: z.number().int().positive(),
});

const cwd = process.cwd();
const tmpDir = path.join(cwd, ".tmp");
const dataDir = path.join(cwd, "data");
const configPath = path.join(cwd, "config", "official-source.json");
const bankPath = path.join(dataDir, "official_bank.json");
const hashPath = path.join(dataDir, "official_bank.hash");
const versionsPath = path.join(dataDir, "official_versions.json");

async function main(): Promise<void> {
  const config = loadConfig();
  await mkdir(tmpDir, { recursive: true });
  await mkdir(dataDir, { recursive: true });

  const documentPath = await downloadDocument(config);
  const text = await extractText(documentPath);
  const parsed = parseQuestions(text, config.expectedQuestionCount);

  if (parsed.confidence < 0.98) {
    throw new Error(`Parsing confidence too low: ${parsed.confidence.toFixed(4)} < 0.98`);
  }

  const validated = validateWithZod(parsed.questions, config.expectedQuestionCount);
  const payload = JSON.stringify(validated, null, 2) + "\n";
  const newHash = computeSHA256(payload);

  const previousPayload = existsSync(bankPath) ? readFileSync(bankPath, "utf8") : "";
  const previousHash = existsSync(hashPath) ? readFileSync(hashPath, "utf8").trim() : "";

  const changed = compareWithPrevious(newHash, previousHash);
  if (!changed) {
    console.log("No official bank changes detected.");
    return;
  }

  persistIfChanged(payload, newHash);
  emitChangelog(previousPayload, payload, previousHash, newHash);
  console.log(`Official bank updated. hash=${newHash}`);
}

function loadConfig(): SourceConfig {
  const raw = readFileSync(configPath, "utf8");
  return sourceConfigSchema.parse(JSON.parse(raw));
}

async function downloadDocument(config: SourceConfig): Promise<string> {
  const urls = [config.url, ...config.fallbackUrls];
  const maxAttempts = 3;
  const outputPath = path.join(tmpDir, "official-source.pdf");

  for (const url of urls) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const buffer = await fetchWithChecks(url, config.timeoutMs);
        writeFileSync(outputPath, buffer);
        return outputPath;
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.error(`Attempt ${attempt}/${maxAttempts} failed for ${url}: ${reason}`);
        if (attempt === maxAttempts) {
          console.error(`URL failed after ${maxAttempts} attempts: ${url}`);
          break;
        }
        const backoffMs = 400 * 2 ** (attempt - 1);
        await sleep(backoffMs);
      }
    }
  }

  throw new Error("All official source URLs failed.");
}

async function fetchWithChecks(url: string, timeoutMs: number): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "accept-encoding": "identity",
        accept: "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8",
        "user-agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "accept-language": "ru-RU,ru;q=0.9,en;q=0.8",
        referer: "https://xn--d1ahaoghbejbc5k.xn--p1ai/",
      },
      signal: controller.signal,
    });

    verifyHttpResponse(resp);

    const contentLengthHeader = resp.headers.get("content-length");
    if (!contentLengthHeader) {
      throw new Error("Missing content-length header.");
    }
    const expectedBytes = Number(contentLengthHeader);
    if (!Number.isFinite(expectedBytes) || expectedBytes < 10_000) {
      throw new Error(`Invalid content-length: ${contentLengthHeader}`);
    }

    if (!resp.body) {
      throw new Error("Empty response body");
    }

    const tmpPath = path.join(tmpDir, `download-${Date.now()}.bin`);
    const ws = createWriteStream(tmpPath);
    await pipeline(Readable.fromWeb(resp.body as never), ws);

    const bytes = readFileSync(tmpPath);
    await rm(tmpPath);

    if (bytes.length !== expectedBytes) {
      throw new Error(`Partial download detected: ${bytes.length}/${expectedBytes}`);
    }
    if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
      throw new Error("Downloaded file is not a valid PDF signature.");
    }

    return bytes;
  } finally {
    clearTimeout(timer);
  }
}

function verifyHttpResponse(resp: Response): void {
  if (!resp.ok || resp.status !== 200) {
    throw new Error(`HTTP check failed. status=${resp.status}`);
  }

  const ct = resp.headers.get("content-type") || "";
  if (!ct.toLowerCase().includes("pdf")) {
    throw new Error(`Unexpected content-type: ${ct}`);
  }
}

async function extractText(documentPath: string): Promise<string> {
  const file = readFileSync(documentPath);
  const extracted = await pdf(file);
  if (extracted.text?.trim()) {
    return extracted.text;
  }

  const cliText = extractTextWithPdftotext(documentPath);
  if (cliText.trim()) {
    return cliText;
  }

  throw new Error("No text extracted from PDF.");
}

function extractTextWithPdftotext(documentPath: string): string {
  const which = spawnSync("which", ["pdftotext"], { encoding: "utf8" });
  if (which.status !== 0) {
    return "";
  }

  const result = spawnSync("pdftotext", ["-layout", documentPath, "-"], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.status !== 0) {
    return "";
  }

  return result.stdout || "";
}

function normalizeText(input: string): string {
  return input
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseQuestions(text: string, expectedCount: number): ParsedResult {
  const normalized = normalizeText(text);
  const answerKey = extractAnswerKey(normalized);

  const blocks = normalized
    .split(/\n(?=\d{1,3}[\).]\s)/g)
    .map((b) => b.trim())
    .filter(Boolean);

  const questions: OfficialQuestion[] = [];

  for (const block of blocks) {
    const qMatch = block.match(/^(\d{1,3})[\).]\s([\s\S]+)$/);
    if (!qMatch) continue;

    const id = Number(qMatch[1]);
    const body = qMatch[2].trim();

    const answerSplit = body
      .split(/\n(?=(?:[А-ВA-C])[\).]\s)/g)
      .map((p) => p.trim())
      .filter(Boolean);

    if (answerSplit.length < 4) continue;

    const questionText = answerSplit[0].replace(/\s+/g, " ").trim();
    const detected = answerSplit.slice(1, 4).map((line) => detectAnswer(line));
    const answersRaw = detected.map((item) => item.text);
    const labels = detected.map((item) => item.label);

    if (answersRaw.some((a) => !a)) continue;
    const marked = detected.filter((a) => a.isCorrect);
    const markedIndex = marked.length === 1 ? detected.findIndex((a) => a.isCorrect) : -1;
    const keyLetter = answerKey.get(id);
    const keyIndex = keyLetter ? labels.findIndex((l) => l === keyLetter) : -1;
    const correctIndex = markedIndex >= 0 ? markedIndex : keyIndex;
    if (correctIndex < 0 || correctIndex > 2) continue;

    questions.push({ id, text: questionText, answers: answersRaw, correctIndex });
  }

  const uniqueIds = new Set(questions.map((q) => q.id)).size;
  const idCoverage = uniqueIds / expectedCount;
  const structureQuality = questions.filter((q) => q.answers.length === 3 && q.text.length > 0).length / expectedCount;
  const orderQuality = isMostlySequential(questions) ? 1 : 0.95;
  const countQuality = Math.min(questions.length / expectedCount, 1);

  const confidence = Number((idCoverage * 0.4 + structureQuality * 0.35 + countQuality * 0.15 + orderQuality * 0.1).toFixed(4));

  return { questions, confidence };
}

function isMostlySequential(questions: OfficialQuestion[]): boolean {
  for (let i = 1; i < questions.length; i++) {
    if (questions[i].id < questions[i - 1].id) return false;
  }
  return true;
}

function detectAnswer(line: string): { label: "A" | "B" | "C"; text: string; isCorrect: boolean } {
  const m = line.match(/^([А-ВA-C])[\).]\s([\s\S]+)$/i);
  if (!m) {
    return { label: "A", text: "", isCorrect: false };
  }

  const label = normalizeChoiceLabel(m[1]);
  const withoutPrefix = m[2].trim();
  const isCorrect = /^(\*|\+|\(\+\)|\[верно\])/i.test(withoutPrefix);
  const text = withoutPrefix.replace(/^(\*|\+|\(\+\)|\[верно\])\s*/i, "").trim();
  return { label, text, isCorrect };
}

function extractAnswerKey(text: string): Map<number, "A" | "B" | "C"> {
  const map = new Map<number, "A" | "B" | "C">();
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    const match = line.match(/^(\d{1,3})\s*(?:[\)\.\-:])\s*([А-ВA-C])$/i);
    if (!match) continue;
    const id = Number(match[1]);
    const letter = normalizeChoiceLabel(match[2]);
    map.set(id, letter);
  }

  return map;
}

function normalizeChoiceLabel(raw: string): "A" | "B" | "C" {
  const up = raw.toUpperCase();
  if (up === "А" || up === "A") return "A";
  if (up === "Б" || up === "B") return "B";
  return "C";
}

function validateWithZod(questions: OfficialQuestion[], expectedCount: number): OfficialBank {
  if (questions.length !== expectedCount) {
    throw new Error(`Expected ${expectedCount} questions, got ${questions.length}`);
  }

  const ids = new Set<number>();
  for (const q of questions) {
    if (ids.has(q.id)) {
      throw new Error(`Duplicate id: ${q.id}`);
    }
    ids.add(q.id);
  }

  return OfficialBankSchema.parse(questions);
}

function computeSHA256(payload: string): string {
  return sha256(payload);
}

function compareWithPrevious(newHash: string, previousHash: string): boolean {
  return !previousHash || newHash !== previousHash;
}

function persistIfChanged(payload: string, hash: string): void {
  const bankTmp = `${bankPath}.tmp`;
  const hashTmp = `${hashPath}.tmp`;

  writeFileSync(bankTmp, payload, "utf8");
  writeFileSync(hashTmp, `${hash}\n`, "utf8");

  renameSync(bankTmp, bankPath);
  renameSync(hashTmp, hashPath);
}

function emitChangelog(previousPayload: string, newPayload: string, previousHash: string, newHash: string): void {
  const previous = previousPayload ? (JSON.parse(previousPayload) as OfficialBank) : [];
  const current = JSON.parse(newPayload) as OfficialBank;

  const summary = diffSummary(previous, current);

  const versions = existsSync(versionsPath)
    ? (JSON.parse(readFileSync(versionsPath, "utf8")) as Array<Record<string, unknown>>)
    : [];

  const entry = {
    timestamp: new Date().toISOString(),
    previousHash: previousHash || null,
    hash: newHash,
    questionCount: current.length,
    diffSummary: summary,
  };

  const next = [...versions, entry];
  writeFileSync(versionsPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

function diffSummary(previous: OfficialBank, current: OfficialBank): DiffSummary {
  const prevMap = new Map(previous.map((q) => [q.id, q]));
  const curMap = new Map(current.map((q) => [q.id, q]));

  let added = 0;
  let removed = 0;
  let changed = 0;

  for (const id of curMap.keys()) {
    if (!prevMap.has(id)) added++;
  }

  for (const id of prevMap.keys()) {
    if (!curMap.has(id)) removed++;
  }

  for (const [id, prevQ] of prevMap.entries()) {
    const curQ = curMap.get(id);
    if (!curQ) continue;
    if (JSON.stringify(prevQ) !== JSON.stringify(curQ)) {
      changed++;
    }
  }

  return { added, removed, changed };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((err) => {
  console.error("update-official failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
