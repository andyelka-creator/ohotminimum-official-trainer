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

type SourceType = "pdf" | "html";

type SourceConfig = {
  sourceType: SourceType;
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
  sourceType: z.enum(["pdf", "html"]),
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

  const downloaded = await downloadSource(config);
  const sourceText = await extractSourceText(downloaded.path, downloaded.detectedType);
  const parsed = parseQuestionsBySource(sourceText, config.expectedQuestionCount, downloaded.detectedType);

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

async function downloadSource(config: SourceConfig): Promise<{ path: string; detectedType: SourceType }> {
  const urls = [config.url, ...config.fallbackUrls];
  const maxAttempts = 3;

  for (const url of urls) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const fetched = await fetchWithChecks(url, config.timeoutMs, config.sourceType);
        const outputPath = path.join(tmpDir, `official-source.${fetched.detectedType}`);
        writeFileSync(outputPath, fetched.buffer);
        return { path: outputPath, detectedType: fetched.detectedType };
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

async function fetchWithChecks(
  url: string,
  timeoutMs: number,
  preferredType: SourceType
): Promise<{ buffer: Buffer; detectedType: SourceType }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "accept-encoding": "identity",
        accept: preferredType === "pdf" ? "application/pdf,application/octet-stream;q=0.9,*/*;q=0.8" : "text/html,*/*;q=0.8",
        "user-agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "accept-language": "ru-RU,ru;q=0.9,en;q=0.8",
        referer: "https://www.garant.ru/",
      },
      signal: controller.signal,
    });

    const detectedType = detectSourceType(resp);
    verifyHttpResponse(resp, detectedType);

    const contentLengthHeader = resp.headers.get("content-length");
    const expectedBytes = contentLengthHeader ? Number(contentLengthHeader) : NaN;
    if (contentLengthHeader && (!Number.isFinite(expectedBytes) || expectedBytes < 10_000)) {
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

    if (Number.isFinite(expectedBytes) && bytes.length !== expectedBytes) {
      throw new Error(`Partial download detected: ${bytes.length}/${expectedBytes}`);
    }

    if (detectedType === "pdf" && !bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
      throw new Error("Downloaded file is not a valid PDF signature.");
    }

    if (detectedType === "html" && bytes.length < 10_000) {
      throw new Error(`HTML payload too small: ${bytes.length} bytes`);
    }

    if (detectedType === "html" && !bytes.includes(Buffer.from("<html", "utf8"))) {
      throw new Error("Downloaded file does not look like HTML.");
    }

    return { buffer: bytes, detectedType };
  } finally {
    clearTimeout(timer);
  }
}

function verifyHttpResponse(resp: Response, sourceType: SourceType): void {
  if (!resp.ok || resp.status !== 200) {
    throw new Error(`HTTP check failed. status=${resp.status}`);
  }

  const ct = (resp.headers.get("content-type") || "").toLowerCase();
  if (sourceType === "pdf" && !ct.includes("pdf")) {
    throw new Error(`Unexpected content-type for PDF source: ${ct}`);
  }
  if (sourceType === "html" && !ct.includes("html")) {
    throw new Error(`Unexpected content-type for HTML source: ${ct}`);
  }
}

function detectSourceType(resp: Response): SourceType {
  const ct = (resp.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("pdf")) return "pdf";
  if (ct.includes("html")) return "html";
  throw new Error(`Unsupported content-type: ${ct || "<empty>"}`);
}

async function extractSourceText(sourcePath: string, sourceType: SourceType): Promise<string> {
  if (sourceType === "html") {
    return htmlToText(decodeHtmlBytes(readFileSync(sourcePath)));
  }

  const file = readFileSync(sourcePath);
  const extracted = await pdf(file);
  if (extracted.text?.trim()) {
    return extracted.text;
  }

  const cliText = extractTextWithPdftotext(sourcePath);
  if (cliText.trim()) {
    return cliText;
  }

  throw new Error("No text extracted from PDF.");
}

function decodeHtmlBytes(bytes: Buffer): string {
  // Read early bytes as latin1 just to detect charset declaration safely.
  const probe = bytes.subarray(0, Math.min(bytes.length, 8192)).toString("latin1");
  const charsetMatch = probe.match(/charset\s*=\s*["']?\s*([a-z0-9._-]+)/i);
  const charset = (charsetMatch?.[1] || "utf-8").toLowerCase();
  const normalized = charset === "windows-1251" || charset === "cp1251" ? "windows-1251" : "utf-8";

  try {
    return new TextDecoder(normalized).decode(bytes);
  } catch {
    return bytes.toString("utf8");
  }
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

function htmlToText(html: string): string {
  const noScript = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  const withBreaks = noScript
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|section|article|tr|h\d)>/gi, "\n");

  const stripped = withBreaks.replace(/<[^>]+>/g, " ");

  return decodeHtmlEntities(stripped)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&laquo;/gi, "«")
    .replace(/&raquo;/gi, "»")
    .replace(/&#(\d+);/g, (_m, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCodePoint(parseInt(h, 16)));
}

function parseQuestionsBySource(text: string, expectedCount: number, sourceType: SourceType): ParsedResult {
  return sourceType === "html" ? parseQuestionsFromGarantText(text, expectedCount) : parseQuestionsFromPdfText(text, expectedCount);
}

function parseQuestionsFromGarantText(text: string, expectedCount: number): ParsedResult {
  const normalized = normalizeText(text);
  const points = [...normalized.matchAll(/(?:^|\n)\s*Вопрос\s*№?\s*(\d{1,3})(?:\s*[\.:])?/gi)];
  const questions: OfficialQuestion[] = [];

  const blocks = points.length > 0 ? splitBlocksByPoints(normalized, points) : splitBlocksFallback(normalized);

  for (const block of blocks) {
    const idMatch = block.match(/^Вопрос\s*№?\s*(\d{1,3})(?:\s*[\.:])?/i);
    if (!idMatch) continue;
    const id = Number(idMatch[1]);

    const body = block.replace(/^Вопрос\s*№?\s*\d{1,3}(?:\s*[\.:])?\s*/i, "");
    const answerMarker = body.search(/\n\s*Правильный\s+ответ\s*[-:]/i);
    const optionsSection = answerMarker >= 0 ? body.slice(0, answerMarker) : body;

    const optionRegex =
      /(?:^|\n)\s*([абвиabcАБВИABC])\s*[\).:-]\s*([\s\S]*?)(?=(?:\n\s*[абвиabcАБВИABC]\s*[\).:-]\s*)|$)/gi;
    const options = [...optionsSection.matchAll(optionRegex)]
      .map((m) => ({
      label: normalizeChoiceLabel(m[1]),
      text: normalizeInlineText(m[2]),
      }))
      .filter((o) => Boolean(o.text));

    if (options.length !== 3) continue;
    if (options.some((o) => !o.text)) continue;

    const firstOptionIdx = body.search(/(?:^|\n|\s)[абвиabcАБВИABC]\s*[\)\.\-:]\s*/i);
    if (firstOptionIdx < 0) continue;

    const questionText = normalizeInlineText(body.slice(0, firstOptionIdx));
    if (!questionText) continue;

    const correctByLetter = body.match(/Правильный\s+ответ\s*[\-:]\s*([абвиabcАБВИABC])(?:\s*[\)\.\-:])?/i);
    let correctIndex = -1;

    if (correctByLetter) {
      const letter = normalizeChoiceLabel(correctByLetter[1]);
      correctIndex = options.findIndex((o) => o.label === letter);
    } else {
      const correctByText = body.match(/Правильный\s+ответ\s*[\-:]\s*([^\n]+)/i);
      if (correctByText) {
        const expectedText = normalizeAnswerKeyText(correctByText[1]);
        correctIndex = options.findIndex((o) => isAnswerTextMatch(o.text, expectedText));
      }
    }

    if (correctIndex < 0 || correctIndex > 2) continue;

    questions.push({
      id,
      text: questionText,
      answers: options.map((o) => o.text),
      correctIndex,
    });
  }

  const uniqueQuestions = dedupeByIdKeepFirst(questions, "garant-html");
  return buildConfidence(uniqueQuestions, expectedCount);
}

function splitBlocksByPoints(text: string, points: RegExpMatchArray[]): string[] {
  const blocks: string[] = [];
  for (let i = 0; i < points.length; i++) {
    const start = points[i].index ?? 0;
    const end = i + 1 < points.length ? points[i + 1].index ?? text.length : text.length;
    blocks.push(text.slice(start, end).trim());
  }
  return blocks;
}

function splitBlocksFallback(text: string): string[] {
  const out: string[] = [];
  const re = /Вопрос\s*№?\s*\d{1,3}(?:\s*[\.:])?[\s\S]*?(?=Вопрос\s*№?\s*\d{1,3}(?:\s*[\.:])?|$)/gi;
  for (const m of text.matchAll(re)) {
    out.push(m[0].trim());
  }
  return out;
}

function parseQuestionsFromPdfText(text: string, expectedCount: number): ParsedResult {
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

    const questionText = normalizeInlineText(answerSplit[0]);
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

  return buildConfidence(questions, expectedCount);
}

function buildConfidence(questions: OfficialQuestion[], expectedCount: number): ParsedResult {
  const uniqueIds = new Set(questions.map((q) => q.id)).size;
  const idCoverage = uniqueIds / expectedCount;
  const structureQuality = questions.filter((q) => q.answers.length === 3 && q.text.length > 0).length / expectedCount;
  const orderQuality = isMostlySequential(questions) ? 1 : 0.95;
  const countQuality = Math.min(questions.length / expectedCount, 1);

  const confidence = Number((idCoverage * 0.4 + structureQuality * 0.35 + countQuality * 0.15 + orderQuality * 0.1).toFixed(4));
  return { questions, confidence };
}

function dedupeByIdKeepFirst(questions: OfficialQuestion[], source: string): OfficialQuestion[] {
  const byId = new Map<number, OfficialQuestion>();
  for (const q of questions) {
    const existing = byId.get(q.id);
    if (!existing) {
      byId.set(q.id, q);
      continue;
    }

    const resolved = resolveDuplicateQuestion(existing, q);
    byId.set(q.id, resolved);
    console.warn(`[WARN] Duplicate id in ${source}: ${q.id}. Resolved by deterministic rule.`);
  }

  return [...byId.values()].sort((a, b) => a.id - b.id);
}

function resolveDuplicateQuestion(current: OfficialQuestion, candidate: OfficialQuestion): OfficialQuestion {
  // Source-specific correction from official publication mirror:
  // for question 118 prefer the variant with "частичная раскопка нор барсука..."
  if (current.id === 118) {
    const marker = "частичная раскопка нор барсука";
    const curHas = current.text.toLowerCase().includes(marker);
    const candHas = candidate.text.toLowerCase().includes(marker);
    if (candHas && !curHas) return candidate;
    if (curHas) return current;
  }

  return current;
}

function normalizeText(input: string): string {
  return input
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeInlineText(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function normalizeAnswerKeyText(input: string): string {
  return normalizeInlineText(input.replace(/^([абвabcАБВABC]|[#*\-–—])\)?\s*/i, ""));
}

function isAnswerTextMatch(optionText: string, keyText: string): boolean {
  const a = normalizeComparableText(optionText);
  const b = normalizeComparableText(keyText);
  if (!a || !b) return false;
  if (a === b || a.startsWith(b) || b.startsWith(a)) return true;

  // Tolerate minor typos in the source answer key (e.g. one-letter differences).
  const dist = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen > 24 ? dist <= 3 : dist <= 2;
}

function normalizeComparableText(input: string): string {
  return normalizeInlineText(
    input
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
  );
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
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
  const text = normalizeInlineText(withoutPrefix.replace(/^(\*|\+|\(\+\)|\[верно\])\s*/i, ""));
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
  if (up === "И") return "C";
  return "C";
}

function validateWithZod(questions: OfficialQuestion[], expectedCount: number): OfficialBank {
  if (questions.length !== expectedCount) {
    const ids = new Set(questions.map((q) => q.id));
    const missing: number[] = [];
    for (let i = 1; i <= expectedCount; i++) {
      if (!ids.has(i)) missing.push(i);
    }
    throw new Error(
      `Expected ${expectedCount} questions, got ${questions.length}. Missing ids: ${missing.join(", ") || "<none>"}`
    );
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
