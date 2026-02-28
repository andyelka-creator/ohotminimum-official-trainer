const statusEl = document.getElementById("status");
const trainerEl = document.getElementById("trainer");
const questionTextEl = document.getElementById("questionText");
const answersEl = document.getElementById("answers");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

let questions = [];
let index = 0;

function renderNotReady() {
  statusEl.className = "status not-ready";
  statusEl.textContent = "SYSTEM NOT READY";
}

function renderQuestion() {
  const q = questions[index];
  questionTextEl.textContent = `${q.id}. ${q.text}`;
  answersEl.innerHTML = "";

  q.answers.forEach((answer, i) => {
    const li = document.createElement("li");
    li.textContent = answer;
    if (i === q.correctIndex) li.classList.add("correct");
    answersEl.appendChild(li);
  });

  prevBtn.disabled = index === 0;
  nextBtn.disabled = index === questions.length - 1;
}

function validateBank(bank) {
  if (!Array.isArray(bank) || bank.length !== 257) return false;

  const ids = new Set();
  for (const q of bank) {
    if (!q || typeof q !== "object") return false;
    if (!Number.isInteger(q.id) || q.id <= 0 || ids.has(q.id)) return false;
    if (typeof q.text !== "string" || !q.text.trim()) return false;
    if (!Array.isArray(q.answers) || q.answers.length !== 3) return false;
    if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 2) return false;
    for (const answer of q.answers) {
      if (typeof answer !== "string" || !answer.trim()) return false;
    }
    ids.add(q.id);
  }

  return true;
}

async function sha256Hex(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function dataUrl(name) {
  return new URL(`./data/${name}`, window.location.href).toString();
}

async function loadFromApi() {
  const status = await fetch("api/status");
  if (!status.ok) throw new Error("API status not ready");

  const statusJson = await status.json();
  if (!statusJson.ready) throw new Error("API not ready");

  const questionsResp = await fetch("api/questions");
  if (!questionsResp.ok) throw new Error("API questions not ready");

  const questionsJson = await questionsResp.json();
  if (!questionsJson.ready || !validateBank(questionsJson.questions)) {
    throw new Error("API invalid official bank");
  }

  return { questions: questionsJson.questions, hash: statusJson.hash };
}

async function loadFromStaticFiles() {
  const [bankResp, hashResp] = await Promise.all([
    fetch(dataUrl("official_bank.json")),
    fetch(dataUrl("official_bank.hash")),
  ]);

  if (!bankResp.ok || !hashResp.ok) {
    throw new Error("Static official files missing");
  }

  const rawBank = await bankResp.text();
  const expectedHash = (await hashResp.text()).trim();
  const actualHash = await sha256Hex(rawBank);

  if (!expectedHash || expectedHash !== actualHash) {
    throw new Error("Static hash mismatch");
  }

  const parsedBank = JSON.parse(rawBank);
  if (!validateBank(parsedBank)) {
    throw new Error("Static bank schema validation failed");
  }

  return { questions: parsedBank, hash: expectedHash };
}

async function bootstrap() {
  try {
    let payload;

    try {
      payload = await loadFromApi();
    } catch {
      payload = await loadFromStaticFiles();
    }

    questions = payload.questions;
    statusEl.className = "status ready";
    statusEl.textContent = `READY • HASH ${payload.hash} • ${questions.length} вопросов`;
    trainerEl.classList.remove("hidden");
    renderQuestion();
  } catch {
    renderNotReady();
  }
}

prevBtn.addEventListener("click", () => {
  if (index > 0) {
    index -= 1;
    renderQuestion();
  }
});

nextBtn.addEventListener("click", () => {
  if (index < questions.length - 1) {
    index += 1;
    renderQuestion();
  }
});

bootstrap();
