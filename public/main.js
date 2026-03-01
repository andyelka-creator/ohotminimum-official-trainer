const statusEl = document.getElementById("status");
const tabsEl = document.getElementById("tabs");

const tabTrainerBtn = document.getElementById("tabTrainer");
const tabProhibitionsBtn = document.getElementById("tabProhibitions");
const tabExamBtn = document.getElementById("tabExam");

const trainerEl = document.getElementById("trainer");
const questionTextEl = document.getElementById("questionText");
const answersEl = document.getElementById("answers");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const backToProhibitionsBtn = document.getElementById("backToProhibitionsBtn");

const prohibitionsEl = document.getElementById("prohibitions");
const prohibitionsListEl = document.getElementById("prohibitionsList");

const examEl = document.getElementById("exam");
const examOrderEl = document.getElementById("examOrder");
const restartExamBtn = document.getElementById("restartExamBtn");
const examStatsEl = document.getElementById("examStats");
const examQuestionEl = document.getElementById("examQuestion");
const examOptionsEl = document.getElementById("examOptions");
const examFeedbackEl = document.getElementById("examFeedback");
const examNextBtn = document.getElementById("examNextBtn");

let questions = [];
let index = 0;
let openedFromProhibitions = false;

const examState = {
  orderMode: "sequential",
  queue: [],
  position: 0,
  correct: 0,
  answered: false,
  selectedIndex: -1,
};

function renderNotReady() {
  statusEl.className = "status not-ready";
  statusEl.textContent = "SYSTEM NOT READY";
}

function setActiveTab(tab) {
  const trainerActive = tab === "trainer";
  const prohibitionsActive = tab === "prohibitions";
  const examActive = tab === "exam";

  tabTrainerBtn.classList.toggle("active", trainerActive);
  tabProhibitionsBtn.classList.toggle("active", prohibitionsActive);
  tabExamBtn.classList.toggle("active", examActive);

  trainerEl.classList.toggle("hidden", !trainerActive);
  prohibitionsEl.classList.toggle("hidden", !prohibitionsActive);
  examEl.classList.toggle("hidden", !examActive);

  if (!trainerActive) {
    openedFromProhibitions = false;
    backToProhibitionsBtn.classList.add("hidden");
  }
}

function renderQuestion() {
  const q = questions[index];
  if (!q) return;

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

function openQuestionById(id, fromProhibitions = false) {
  const nextIndex = questions.findIndex((q) => q.id === id);
  if (nextIndex < 0) return;

  index = nextIndex;
  renderQuestion();
  setActiveTab("trainer");

  openedFromProhibitions = fromProhibitions;
  backToProhibitionsBtn.classList.toggle("hidden", !openedFromProhibitions);
}

function prohibitionQuestions() {
  return questions
    .filter((q) => /^При осуществлении охоты запрещается/i.test(q.text))
    .sort((a, b) => a.id - b.id);
}

function buildProhibitionsList() {
  prohibitionsListEl.innerHTML = "";
  const list = prohibitionQuestions();

  for (const q of list) {
    const item = document.createElement("article");
    item.className = "list-item";

    const title = document.createElement("p");
    title.className = "list-item-title";
    title.textContent = q.answers[q.correctIndex];

    const meta = document.createElement("p");
    meta.className = "list-item-meta";
    meta.textContent = `Вопрос #${q.id}`;

    const actions = document.createElement("div");
    actions.className = "list-actions";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "list-link";
    button.textContent = `К вопросу #${q.id}`;
    button.addEventListener("click", () => openQuestionById(q.id, true));

    actions.appendChild(button);
    item.append(title, meta, actions);
    prohibitionsListEl.appendChild(item);
  }
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
  const [bankResp, hashResp] = await Promise.all([fetch(dataUrl("official_bank.json")), fetch(dataUrl("official_bank.hash"))]);

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

function shuffled(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function startExam() {
  examState.orderMode = examOrderEl.value;
  const base = questions.map((_, i) => i);
  examState.queue = examState.orderMode === "random" ? shuffled(base) : base;
  examState.position = 0;
  examState.correct = 0;
  examState.answered = false;
  examState.selectedIndex = -1;
  renderExam();
}

function currentExamQuestion() {
  const idx = examState.queue[examState.position];
  return questions[idx] || null;
}

function renderExamStats() {
  examStatsEl.textContent = `Вопрос ${Math.min(examState.position + 1, questions.length)} / ${questions.length} • Верных: ${examState.correct}`;
}

function setFeedback(text, type = "") {
  examFeedbackEl.textContent = text;
  examFeedbackEl.classList.remove("good", "bad");
  if (type) examFeedbackEl.classList.add(type);
}

function renderExam() {
  renderExamStats();
  examOptionsEl.innerHTML = "";
  examNextBtn.disabled = true;
  setFeedback("");

  if (examState.position >= questions.length) {
    examQuestionEl.textContent = `Экзамен завершен. Результат: ${examState.correct} из ${questions.length}.`;
    return;
  }

  const q = currentExamQuestion();
  if (!q) return;

  examQuestionEl.textContent = `${q.id}. ${q.text}`;

  q.answers.forEach((answer, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "exam-option";
    btn.textContent = answer;
    btn.disabled = examState.answered;
    btn.addEventListener("click", () => submitExamAnswer(i));
    examOptionsEl.appendChild(btn);
  });
}

function applyExamResultStyles(q, selected) {
  const buttons = [...examOptionsEl.querySelectorAll(".exam-option")];
  buttons.forEach((btn, i) => {
    btn.disabled = true;
    if (selected === q.correctIndex && i === q.correctIndex) {
      btn.classList.add("correct");
      return;
    }

    if (selected !== q.correctIndex) {
      if (i === q.correctIndex) {
        btn.classList.add("correct");
      } else {
        btn.classList.add("strike");
      }
      if (i === selected) {
        btn.classList.add("incorrect");
      }
    }
  });
}

function submitExamAnswer(selectedIndex) {
  if (examState.answered || examState.position >= questions.length) return;

  examState.answered = true;
  examState.selectedIndex = selectedIndex;

  const q = currentExamQuestion();
  if (!q) return;

  if (selectedIndex === q.correctIndex) {
    examState.correct += 1;
    setFeedback("Верно.", "good");
  } else {
    setFeedback("Неверно. Показан правильный ответ.", "bad");
  }

  applyExamResultStyles(q, selectedIndex);
  examNextBtn.disabled = false;
  renderExamStats();
}

function nextExamQuestion() {
  if (!examState.answered) return;

  examState.position += 1;
  examState.answered = false;
  examState.selectedIndex = -1;
  renderExam();
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

    tabsEl.classList.remove("hidden");
    trainerEl.classList.remove("hidden");
    prohibitionsEl.classList.remove("hidden");
    examEl.classList.remove("hidden");

    buildProhibitionsList();
    renderQuestion();
    startExam();
    setActiveTab("trainer");
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

backToProhibitionsBtn.addEventListener("click", () => {
  setActiveTab("prohibitions");
});

tabTrainerBtn.addEventListener("click", () => setActiveTab("trainer"));
tabProhibitionsBtn.addEventListener("click", () => setActiveTab("prohibitions"));
tabExamBtn.addEventListener("click", () => setActiveTab("exam"));

restartExamBtn.addEventListener("click", () => startExam());
examOrderEl.addEventListener("change", () => startExam());
examNextBtn.addEventListener("click", () => nextExamQuestion());

bootstrap();
