const statusEl = document.getElementById("status");
const tabsEl = document.getElementById("tabs");

const tabTrainerBtn = document.getElementById("tabTrainer");
const tabRulesBtn = document.getElementById("tabRules");
const tabExamBtn = document.getElementById("tabExam");
const tabInsightsBtn = document.getElementById("tabInsights");

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

const insightsEl = document.getElementById("insights");
const insightsSummaryEl = document.getElementById("insightsSummary");

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

function answerPrefix(index) {
  if (index === 0) return "а)";
  if (index === 1) return "б)";
  return "в)";
}

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
  const insightsActive = tab === "insights";

  tabState(tabTrainerBtn, trainerActive);
  tabState(tabRulesBtn, rulesActive);
  tabState(tabExamBtn, examActive);
  tabState(tabInsightsBtn, insightsActive);

  trainerEl.classList.toggle("hidden", !trainerActive);
  rulesEl.classList.toggle("hidden", !rulesActive);
  examEl.classList.toggle("hidden", !examActive);
  insightsEl.classList.toggle("hidden", !insightsActive);

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
    li.textContent = `${answerPrefix(i)} ${answer}`;
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

function inferObjectLabel(q) {
  const text = `${q.text} ${q.answers[q.correctIndex]}`.toLowerCase();
  const pairs = [
    ["косул", "Косуля"],
    ["лось", "Лось"],
    ["олен", "Олень"],
    ["лан", "Лань"],
    ["кабан", "Кабан"],
    ["медвед", "Медведь"],
    ["копытн", "Копытные"],
    ["болотно-лугов", "Болотно-луговая дичь"],
    ["водоплава", "Водоплавающая дичь"],
    ["боров", "Боровая дичь"],
    ["пушн", "Пушные животные"],
    ["коллективной охоты", "Коллективная охота"],
  ];

  for (const [needle, label] of pairs) {
    if (text.includes(needle)) return label;
  }
  return "Общий режим охоты";
}

function inferNormType(q) {
  const t = q.text.toLowerCase();
  if (t.includes("запрещается")) return "Запрет";
  if (t.includes("срок") || t.includes("в какие сроки") || t.includes("продолжительность")) return "Срок";
  if (t.includes("обязан") || t.includes("должен") || t.includes("требуется")) return "Обязанность";
  if (t.includes("документ") || t.includes("путевк") || t.includes("список лиц")) return "Документы";
  return "Правило";
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

      const chips = document.createElement("div");
      chips.className = "mb-2 flex flex-wrap gap-2";

      const objectChip = document.createElement("span");
      objectChip.className = "rounded-full border border-slate-600 px-2 py-0.5 text-xs text-appmuted";
      objectChip.textContent = inferObjectLabel(q);

      const ruleChip = document.createElement("span");
      ruleChip.className = "rounded-full border border-emerald-700 px-2 py-0.5 text-xs text-emerald-300";
      ruleChip.textContent = inferNormType(q);

      chips.append(objectChip, ruleChip);

      const itemTitle = document.createElement("p");
      itemTitle.className = "text-sm text-appmuted";
      itemTitle.textContent = `Вопрос: ${q.text}`;

      const answerText = document.createElement("p");
      answerText.className = "mt-2 text-sm";
      answerText.textContent = `Правильный ответ: ${q.answers[q.correctIndex]}`;

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
      row.append(chips, itemTitle, answerText, itemMeta, actions);
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

function inferDateCategory(q) {
  const t = q.text.toLowerCase();
  if (t.includes("взросл")) return "Взрослые самцы";
  if (t.includes("все половозрастные")) return "Все половозрастные группы";
  if (t.includes("до 1 года")) return "Молодняк (до 1 года)";
  if (t.includes("продолжительность сезона")) return "Длительность сезона";
  return "Срок охоты";
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

    const context = document.createElement("p");
    context.className = "mt-1 text-xs text-appmuted";
    context.textContent = `${inferObjectLabel(q)} • ${inferDateCategory(q)}`;

    const questionLine = document.createElement("p");
    questionLine.className = "mt-1 text-xs text-appmuted";
    questionLine.textContent = `Вопрос: ${q.text}`;

    const actions = document.createElement("div");
    actions.className = "mt-2";

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "item-link";
    openBtn.textContent = `Открыть #${q.id}`;
    openBtn.addEventListener("click", () => openQuestionById(q.id, true));

    actions.appendChild(openBtn);
    head.append(title, id);
    row.append(head, context, period, questionLine, actions);
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
    btn.textContent = `${answerPrefix(i)} ${answer}`;
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

function pct(part, total) {
  return total > 0 ? ((part / total) * 100).toFixed(1) : "0.0";
}

function buildInsights() {
  insightsSummaryEl.innerHTML = "";
  const total = questions.length;
  if (!total) return;

  let strictLongest = 0;
  let longestOrTie = 0;
  const byPosition = [0, 0, 0];

  for (const q of questions) {
    const lengths = q.answers.map((a) => a.replace(/\s+/g, " ").trim().length);
    const correctLen = lengths[q.correctIndex];
    const maxLen = Math.max(...lengths);
    const maxCount = lengths.filter((len) => len === maxLen).length;
    if (correctLen === maxLen) {
      longestOrTie += 1;
      if (maxCount === 1) {
        strictLongest += 1;
      }
    }
    byPosition[q.correctIndex] += 1;
  }

  const block = document.createElement("article");
  block.className = "rounded-xl border border-slate-700 bg-slate-900/30 p-4";
  block.innerHTML = `
    <p class="text-sm">По вашему текущему банку (${total} вопросов):</p>
    <ul class="mt-2 list-disc space-y-1 pl-5 text-sm">
      <li>правильный ответ строго самый длинный: <strong>${strictLongest} / ${total}</strong> (≈ ${pct(strictLongest, total)}%)</li>
      <li>правильный ответ самый длинный или в ничьей по длине: <strong>${longestOrTie} / ${total}</strong> (≈ ${pct(longestOrTie, total)}%)</li>
    </ul>
    <p class="mt-3 text-sm">Распределение позиции правильного варианта:</p>
    <ul class="mt-2 list-disc space-y-1 pl-5 text-sm">
      <li>а (index 0): <strong>${byPosition[0]}</strong></li>
      <li>б (index 1): <strong>${byPosition[1]}</strong></li>
      <li>в (index 2): <strong>${byPosition[2]}</strong></li>
    </ul>
    <p class="mt-3 text-sm text-appmuted">Вывод: шаблон есть, но опираться только на длину и позицию рискованно.</p>
  `;

  insightsSummaryEl.appendChild(block);
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
    statusEl.classList.add("hidden");
    statusEl.textContent = "";

    tabsEl.classList.remove("hidden");
    trainerEl.classList.remove("hidden");
    rulesEl.classList.remove("hidden");
    examEl.classList.remove("hidden");
    insightsEl.classList.remove("hidden");

    buildRuleGroups();
    buildDateMatrix();
    buildInsights();
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
tabInsightsBtn.addEventListener("click", () => setActiveTab("insights"));

restartExamBtn.addEventListener("click", () => startExam());
examOrderEl.addEventListener("change", () => startExam());
examNextBtn.addEventListener("click", () => nextExamQuestion());

bootstrap();
