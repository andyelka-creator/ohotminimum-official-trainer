const statusEl = document.getElementById("status");
const tabsEl = document.getElementById("tabs");

const tabTrainerBtn = document.getElementById("tabTrainer");
const tabRulesBtn = document.getElementById("tabRules");
const tabExamBtn = document.getElementById("tabExam");

const trainerEl = document.getElementById("trainer");
const questionTextEl = document.getElementById("questionText");
const answersEl = document.getElementById("answers");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const backToRulesBtn = document.getElementById("backToRulesBtn");

const rulesEl = document.getElementById("rules");
const rulesGridEl = document.getElementById("rulesGrid");
const dateMatrixEl = document.getElementById("dateMatrix");

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
let openedFromRules = false;

const RULE_GROUPS = [
  {
    title: "Запреты при осуществлении охоты",
    description: "Что строго запрещено в процессе охоты.",
    matcher: (q) => /^При осуществлении охоты запрещается/i.test(q.text),
  },
  {
    title: "Сроки охоты на взрослых самцов",
    description: "Сроки по отдельным видам и специальным режимам.",
    matcher: (q) => /Срок охоты на взрослых самцов/i.test(q.text),
  },
  {
    title: "Сроки по половозрастным группам",
    description: "Вопросы формата «в какие сроки осуществляется».",
    matcher: (q) => /^В какие сроки охоты осуществляется/i.test(q.text),
  },
  {
    title: "Охота на копытных по целям",
    description: "Одно правило, разные цели осуществления охоты.",
    matcher: (q) => /^Охота на копытных животных в целях/i.test(q.text),
  },
  {
    title: "Коллективная охота: документы и состав",
    description: "Списки участников, путевки, требования к данным.",
    matcher: (q) => /^При осуществлении коллективной охоты/i.test(q.text),
  },
  {
    title: "Специальные правила по медведю",
    description: "Отдельные обязательные условия для охоты на медведя.",
    matcher: (q) => /^При осуществлении охоты на медведей/i.test(q.text),
  },
];

const examState = {
  orderMode: "sequential",
  queue: [],
  position: 0,
  correct: 0,
  answered: false,
};

function renderNotReady() {
  statusEl.className = "rounded-xl border border-appdanger bg-apppanel p-4 text-sm font-semibold text-appdanger";
  statusEl.textContent = "SYSTEM NOT READY";
}

function tabState(button, active) {
  button.className = active
    ? "tab-btn active"
    : "tab-btn";
}

function setActiveTab(tab) {
  const trainerActive = tab === "trainer";
  const rulesActive = tab === "rules";
  const examActive = tab === "exam";

  tabState(tabTrainerBtn, trainerActive);
  tabState(tabRulesBtn, rulesActive);
  tabState(tabExamBtn, examActive);

  trainerEl.classList.toggle("hidden", !trainerActive);
  rulesEl.classList.toggle("hidden", !rulesActive);
  examEl.classList.toggle("hidden", !examActive);

  if (!trainerActive) {
    openedFromRules = false;
    backToRulesBtn.classList.add("hidden");
  }
}

function renderQuestion() {
  const q = questions[index];
  if (!q) return;

  questionTextEl.textContent = `${q.id}. ${q.text}`;
  answersEl.innerHTML = "";

  q.answers.forEach((answer, i) => {
    const li = document.createElement("li");
    li.className =
      "rounded-lg border px-3 py-2 text-sm leading-relaxed " +
      (i === q.correctIndex ? "border-appaccent bg-emerald-900/20" : "border-slate-700 bg-slate-900/30");
    li.textContent = answer;
    answersEl.appendChild(li);
  });

  prevBtn.disabled = index === 0;
  nextBtn.disabled = index === questions.length - 1;
}

function openQuestionById(id, fromRules = false) {
  const nextIndex = questions.findIndex((q) => q.id === id);
  if (nextIndex < 0) return;

  index = nextIndex;
  renderQuestion();
  setActiveTab("trainer");

  openedFromRules = fromRules;
  backToRulesBtn.classList.toggle("hidden", !openedFromRules);
}

function buildRuleGroups() {
  rulesGridEl.innerHTML = "";

  for (const group of RULE_GROUPS) {
    const matched = questions.filter((q) => group.matcher(q)).sort((a, b) => a.id - b.id);
    if (matched.length === 0) continue;

    const card = document.createElement("article");
    card.className = "rounded-xl border border-slate-700 bg-slate-900/30 p-3";

    const title = document.createElement("h3");
    title.className = "text-base font-semibold";
    title.textContent = group.title;

    const meta = document.createElement("p");
    meta.className = "mt-1 text-xs text-appmuted";
    meta.textContent = `${group.description} • ${matched.length} вопросов`;

    const list = document.createElement("div");
    list.className = "mt-3 grid gap-2";

    matched.forEach((q) => {
      const row = document.createElement("div");
      row.className = "rounded-lg border border-slate-700 bg-slate-950/40 p-3";

      const itemTitle = document.createElement("p");
      itemTitle.className = "text-sm";
      itemTitle.textContent = q.answers[q.correctIndex];

      const itemMeta = document.createElement("p");
      itemMeta.className = "mt-1 text-xs text-appmuted";
      itemMeta.textContent = `Вопрос #${q.id}`;

      const actions = document.createElement("div");
      actions.className = "mt-2";

      const openBtn = document.createElement("button");
      openBtn.type = "button";
      openBtn.className = "item-link";
      openBtn.textContent = `К вопросу #${q.id}`;
      openBtn.addEventListener("click", () => openQuestionById(q.id, true));

      actions.appendChild(openBtn);
      row.append(itemTitle, itemMeta, actions);
      list.appendChild(row);
    });

    card.append(title, meta, list);
    rulesGridEl.appendChild(card);
  }
}

function extractPeriodText(answer) {
  const clean = answer.replace(/\s+/g, " ").trim();
  const range = clean.match(/с\s+\d{1,2}\s+[а-яё]+\s+по\s+\d{1,2}\s+[а-яё]+/i);
  if (range) return range[0];
  const yearRange = clean.match(/с\s+\d{1,2}\s+[а-яё]+\s+по\s+\d{1,2}\s+[а-яё]+|по\s+\d{1,2}\s+[а-яё]+/i);
  if (yearRange) return yearRange[0];
  return clean;
}

function buildDateMatrix() {
  dateMatrixEl.innerHTML = "";

  const dateQuestions = questions
    .filter((q) => {
      const t = q.text.toLowerCase();
      const a = q.answers[q.correctIndex].toLowerCase();
      return /срок|сроки|в какие сроки|продолжительность сезона|осуществляется охота|с\s+\d{1,2}|по\s+\d{1,2}/i.test(t + " " + a);
    })
    .sort((a, b) => a.id - b.id);

  dateQuestions.forEach((q) => {
    const row = document.createElement("article");
    row.className = "rounded-xl border border-slate-700 bg-slate-900/30 p-3";

    const head = document.createElement("div");
    head.className = "flex flex-wrap items-center justify-between gap-2";

    const title = document.createElement("strong");
    title.className = "text-sm font-semibold";
    title.textContent = q.text;

    const id = document.createElement("span");
    id.className = "text-xs text-appmuted";
    id.textContent = `#${q.id}`;

    const period = document.createElement("p");
    period.className = "mt-2 text-sm";
    period.textContent = extractPeriodText(q.answers[q.correctIndex]);

    const actions = document.createElement("div");
    actions.className = "mt-2";

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "item-link";
    openBtn.textContent = `Открыть #${q.id}`;
    openBtn.addEventListener("click", () => openQuestionById(q.id, true));

    actions.appendChild(openBtn);
    head.append(title, id);
    row.append(head, period, actions);
    dateMatrixEl.appendChild(row);
  });
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
  examFeedbackEl.className = `mt-3 min-h-6 text-sm ${type === "good" ? "text-appaccent" : type === "bad" ? "text-appdanger" : ""}`;
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
    statusEl.className = "rounded-xl border border-appaccent bg-apppanel p-4 text-sm";
    statusEl.textContent = `READY • HASH ${payload.hash} • ${questions.length} вопросов`;

    tabsEl.classList.remove("hidden");
    trainerEl.classList.remove("hidden");
    rulesEl.classList.remove("hidden");
    examEl.classList.remove("hidden");

    buildRuleGroups();
    buildDateMatrix();
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

backToRulesBtn.addEventListener("click", () => setActiveTab("rules"));

tabTrainerBtn.addEventListener("click", () => setActiveTab("trainer"));
tabRulesBtn.addEventListener("click", () => setActiveTab("rules"));
tabExamBtn.addEventListener("click", () => setActiveTab("exam"));

restartExamBtn.addEventListener("click", () => startExam());
examOrderEl.addEventListener("change", () => startExam());
examNextBtn.addEventListener("click", () => nextExamQuestion());

bootstrap();
