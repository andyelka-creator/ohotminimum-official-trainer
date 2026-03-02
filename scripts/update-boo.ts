import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { z } from "zod";

type BooSourceConfig = {
  bundleUrls: string[];
  explanationsUrls: string[];
  localBundlePath?: string;
  localExplanationsPath?: string;
  expectedQuestionCount: number;
  timeoutMs: number;
  maxRetries: number;
};

const root = process.cwd();
const configPath = path.join(root, "config", "boo-source.json");
const outputPath = path.join(root, "data", "boo_bank.json");
const outputHashPath = path.join(root, "data", "boo_bank.hash");

const BooQuestionSchema = z.object({
  id: z.number().int().positive(),
  category: z.string().min(1),
  text: z.string().min(1),
  answers: z.array(z.string().min(1)).length(3),
  correctIndex: z.number().int().min(0).max(2),
  explanation: z.string().min(1),
});

const BooBankSchema = z.array(BooQuestionSchema);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

async function readConfig(): Promise<BooSourceConfig> {
  const raw = await readFile(configPath, "utf8");
  return JSON.parse(raw) as BooSourceConfig;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchTextWithRetry(urls: string[], timeoutMs: number, maxRetries: number): Promise<string> {
  let lastError: Error | null = null;

  for (const url of urls) {
    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        const response = await fetchWithTimeout(url, timeoutMs);
        if (!response.ok) {
          throw new Error(`HTTP check failed. status=${response.status}`);
        }

        const contentLength = response.headers.get("content-length");
        if (!contentLength) {
          throw new Error("Missing content-length header.");
        }

        const expectedBytes = Number(contentLength);
        if (!Number.isFinite(expectedBytes) || expectedBytes < 1000) {
          throw new Error(`Suspicious content-length: ${contentLength}`);
        }

        const text = await response.text();
        const actualBytes = Buffer.byteLength(text, "utf8");
        if (actualBytes < expectedBytes * 0.8) {
          throw new Error(`Partial download suspected. expected~${expectedBytes}, actual=${actualBytes}`);
        }

        return text;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        lastError = new Error(message);
        console.warn(`Attempt ${attempt}/${maxRetries} failed for ${url}: ${message}`);
        if (attempt < maxRetries) {
          const delay = Math.min(12000, 1000 * 2 ** (attempt - 1));
          await sleep(delay);
        }
      }
    }

    console.warn(`URL failed after ${maxRetries} attempts: ${url}`);
  }

  throw lastError ?? new Error("All URLs failed.");
}

function extractBooArrayLiteral(bundle: string): string {
  const marker = "To=[";
  const markerIndex = bundle.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error("Boo dataset marker not found in JS bundle.");
  }

  const start = markerIndex + marker.length - 1; // points to '['
  let depth = 0;
  let quote: string | null = null;
  let escaped = false;

  for (let i = start; i < bundle.length; i += 1) {
    const ch = bundle[i];

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === quote) {
        quote = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }

    if (ch === "[") {
      depth += 1;
      continue;
    }

    if (ch === "]") {
      depth -= 1;
      if (depth === 0) {
        return bundle.slice(start, i + 1);
      }
    }
  }

  throw new Error("Failed to locate end of boo dataset array.");
}

const RawBooQuestionSchema = z.object({
  id: z.number().int().positive(),
  category: z.string().min(1),
  question: z.string().min(1),
  options: z.array(z.string().min(1)).length(3),
  correct: z.number().int().min(0).max(2),
});

type RawBooQuestion = z.infer<typeof RawBooQuestionSchema>;

function parseBooQuestions(bundle: string): RawBooQuestion[] {
  const literal = extractBooArrayLiteral(bundle);
  const parsed = vm.runInNewContext(literal, {});
  const safe = z.array(RawBooQuestionSchema).parse(parsed);
  return safe;
}

function validateUniqueIds(questions: RawBooQuestion[]) {
  const ids = new Set<number>();
  for (const q of questions) {
    if (ids.has(q.id)) {
      throw new Error(`Duplicate question id in boo source: ${q.id}`);
    }
    ids.add(q.id);
  }
}

function parseExplanations(raw: string): Record<string, string> {
  const parsed = JSON.parse(raw) as unknown;
  return z.record(z.string()).parse(parsed);
}

async function resolveBundle(config: BooSourceConfig): Promise<string> {
  try {
    return await fetchTextWithRetry(config.bundleUrls, config.timeoutMs, config.maxRetries);
  } catch (error) {
    if (!config.localBundlePath) throw error;
    const fallbackPath = path.join(root, config.localBundlePath);
    console.warn(`Remote bundle unavailable. Using local fallback: ${fallbackPath}`);
    return readFile(fallbackPath, "utf8");
  }
}

async function resolveExplanations(config: BooSourceConfig): Promise<string> {
  try {
    return await fetchTextWithRetry(config.explanationsUrls, config.timeoutMs, config.maxRetries);
  } catch (error) {
    if (!config.localExplanationsPath) throw error;
    const fallbackPath = path.join(root, config.localExplanationsPath);
    console.warn(`Remote explanations unavailable. Using local fallback: ${fallbackPath}`);
    return readFile(fallbackPath, "utf8");
  }
}

async function run() {
  const config = await readConfig();

  const bundleText = await resolveBundle(config);
  const rawQuestions = parseBooQuestions(bundleText);

  if (rawQuestions.length !== config.expectedQuestionCount) {
    throw new Error(`Expected ${config.expectedQuestionCount} questions, got ${rawQuestions.length}`);
  }
  validateUniqueIds(rawQuestions);

  const explanationsText = await resolveExplanations(config);
  const explanations = parseExplanations(explanationsText);

  const normalized = rawQuestions
    .sort((a, b) => a.id - b.id)
    .map((q) => {
      const explanation = (explanations[String(q.id)] || "").trim();
      if (!explanation) {
        throw new Error(`Missing explanation for question id=${q.id}`);
      }
      return {
        id: q.id,
        category: q.category,
        text: q.question.trim(),
        answers: q.options.map((item) => item.trim()),
        correctIndex: q.correct,
        explanation,
      };
    });

  BooBankSchema.parse(normalized);

  const bankJson = `${JSON.stringify(normalized, null, 2)}\n`;
  const hash = sha256Hex(bankJson);

  await writeFile(outputPath, bankJson, "utf8");
  await writeFile(outputHashPath, `${hash}\n`, "utf8");

  console.log(`Boo bank updated. hash=${hash}`);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`update-boo failed: ${message}`);
  process.exitCode = 1;
});
