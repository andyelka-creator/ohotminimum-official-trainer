const statusEl = document.getElementById("status");
const tabsEl = document.getElementById("tabs");

const tabTrainerBtn = document.getElementById("tabTrainer");
const tabRulesBtn = document.getElementById("tabRules");
const tabExamBtn = document.getElementById("tabExam");
const tabInsightsBtn = document.getElementById("tabInsights");
const buildUpdateBadgeEl = document.getElementById("buildUpdateBadge");

const trainerEl = document.getElementById("trainer");
const trainerSwipeAreaEl = document.getElementById("trainerSwipeArea");
const trainerModeClassicBtn = document.getElementById("trainerModeClassicBtn");
const trainerModeThemeBtn = document.getElementById("trainerModeThemeBtn");
const trainerModeAntiHeurBtn = document.getElementById("trainerModeAntiHeurBtn");
const trainerClassicPanelEl = document.getElementById("trainerClassicPanel");
const trainerThemePanelEl = document.getElementById("trainerThemePanel");
const trainerAntiHeurPanelEl = document.getElementById("trainerAntiHeurPanel");
const questionTextEl = document.getElementById("questionText");
const answersEl = document.getElementById("answers");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const backToRulesBtn = document.getElementById("backToRulesBtn");
const themeTrainerTabsEl = document.getElementById("themeTrainerTabs");
const startThemeDrillBtn = document.getElementById("startThemeDrillBtn");
const themeDrillStatsEl = document.getElementById("themeDrillStats");
const themeDrillQuestionEl = document.getElementById("themeDrillQuestion");
const themeDrillOptionsEl = document.getElementById("themeDrillOptions");
const themeDrillFeedbackEl = document.getElementById("themeDrillFeedback");
const themeDrillNextBtn = document.getElementById("themeDrillNextBtn");
const antiHeurMetaEl = document.getElementById("antiHeurMeta");
const antiHeurListEl = document.getElementById("antiHeurList");

const rulesEl = document.getElementById("rules");
const rulesSwipeAreaEl = document.getElementById("rulesSwipeArea");
const rulesModeRuleBtn = document.getElementById("rulesModeRuleBtn");
const rulesModeDateBtn = document.getElementById("rulesModeDateBtn");
const rulesModeIndicatorEl = document.getElementById("rulesModeIndicator");
const rulesRulePanelEl = document.getElementById("rulesRulePanel");
const rulesDatePanelEl = document.getElementById("rulesDatePanel");
const rulesTopicTabsEl = document.getElementById("rulesTopicTabs");
const rulesTopicMetaEl = document.getElementById("rulesTopicMeta");
const rulesTopicContentEl = document.getElementById("rulesTopicContent");
const dateTopicTabsEl = document.getElementById("dateTopicTabs");
const dateTopicMetaEl = document.getElementById("dateTopicMeta");
const dateTopicContentEl = document.getElementById("dateTopicContent");

const examEl = document.getElementById("exam");
const examOrderEl = document.getElementById("examOrder");
const examCountEl = document.getElementById("examCount");
const minutesPerQuestionEl = document.getElementById("minutesPerQuestion");
const restartExamBtn = document.getElementById("restartExamBtn");
const examStatsEl = document.getElementById("examStats");
const examQuestionTimerEl = document.getElementById("examQuestionTimer");
const examProgressBarEl = document.getElementById("examProgressBar");
const examQuestionEl = document.getElementById("examQuestion");
const examOptionsEl = document.getElementById("examOptions");
const examFeedbackEl = document.getElementById("examFeedback");
const examNextBtn = document.getElementById("examNextBtn");
const finishExamBtn = document.getElementById("finishExamBtn");

const insightsEl = document.getElementById("insights");
const insightsSummaryEl = document.getElementById("insightsSummary");

let questions = [];
let index = 0;
let rulesBuilt = false;
let insightsBuilt = false;
let rulesThemes = [];
let dateThemes = [];
let activeRulesThemeId = "";
let activeDateThemeId = "";
let activeTrainerThemeId = "";
let trainerMode = "classic";
let trainerSwipeStartX = 0;
let trainerSwipeStartY = 0;
let trainerSwipeIgnore = false;
let antiHeuristicQuestions = [];
let rulesMode = "rule";
let rulesSwipeStartX = 0;
let rulesSwipeStartY = 0;
let rulesSwipeIgnore = false;
const BUILD_SEEN_KEY = "ohotminimum_seen_build_id";
let trainerReturnContext = null;

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
  questionCount: 100,
  minutesPerQuestion: 1,
  durationMs: 0,
  questionDurationMs: 0,
  questionStartedAt: 0,
  queue: [],
  position: 0,
  correct: 0,
  answered: false,
  startedAt: 0,
  finishedAt: 0,
  finishedReason: "",
  autoNextTimeoutId: null,
  autoNextIntervalId: null,
  statsTickerId: null,
  started: false,
};

const themeDrillState = {
  active: false,
  themeId: "",
  questionIds: [],
  streakById: new Map(),
  currentQuestionId: null,
  answered: false,
  autoNextTimeoutId: null,
  autoNextIntervalId: null,
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

function hideBuildUpdateBadge() {
  if (!buildUpdateBadgeEl) return;
  buildUpdateBadgeEl.classList.add("hidden");
}

function showBuildUpdateBadge(buildId) {
  if (!buildUpdateBadgeEl) return;
  buildUpdateBadgeEl.classList.remove("hidden");
  buildUpdateBadgeEl.onclick = () => {
    localStorage.setItem(BUILD_SEEN_KEY, buildId);
    hideBuildUpdateBadge();
  };
}

async function checkBuildUpdateBadge() {
  try {
    const resp = await fetch(`./build-meta.json?v=${Date.now()}`, { cache: "no-store" });
    if (!resp.ok) return;
    const meta = await resp.json();
    const buildId = String(meta?.buildId || "");
    if (!buildId) return;

    const seenBuildId = localStorage.getItem(BUILD_SEEN_KEY);
    if (!seenBuildId) {
      localStorage.setItem(BUILD_SEEN_KEY, buildId);
      hideBuildUpdateBadge();
      return;
    }
    if (seenBuildId !== buildId) {
      // New deployment detected for this user history.
      showBuildUpdateBadge(buildId);
      return;
    }
    hideBuildUpdateBadge();
  } catch {
    // Silent fallback: no badge if metadata endpoint unavailable.
  }
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

  // Lazy-render heavy sections only when the user opens them on mobile/web.
  if (rulesActive && !rulesBuilt) {
    renderRulesThemes();
    rulesBuilt = true;
  }
  if (insightsActive && !insightsBuilt) {
    buildInsights();
    insightsBuilt = true;
  }

  if (!trainerActive) {
    updateTrainerReturnControls();
  }
}

function setTrainerMode(mode) {
  if (mode === "theme" || mode === "anti-heur") {
    trainerMode = mode;
  } else {
    trainerMode = "classic";
  }
  const classic = trainerMode === "classic";
  const theme = trainerMode === "theme";
  const antiHeur = trainerMode === "anti-heur";

  trainerModeClassicBtn.className = classic ? "tab-btn active" : "tab-btn";
  trainerModeThemeBtn.className = theme ? "tab-btn active" : "tab-btn";
  trainerModeAntiHeurBtn.className = antiHeur ? "tab-btn active" : "tab-btn";
  trainerClassicPanelEl.classList.toggle("hidden", !classic);
  trainerThemePanelEl.classList.toggle("hidden", !theme);
  trainerAntiHeurPanelEl.classList.toggle("hidden", !antiHeur);
  updateTrainerReturnControls();
}

function updateTrainerReturnControls() {
  if (trainerReturnContext) {
    backToRulesBtn.classList.remove("hidden");
    backToRulesBtn.textContent = `← Вернуться к ${trainerReturnContext.label}`;
    prevBtn.textContent = "Назад к разделу";
    return;
  }
  backToRulesBtn.classList.add("hidden");
  backToRulesBtn.textContent = "← Вернуться к разделу";
  prevBtn.textContent = "Назад";
}

function restorePageScroll(scrollY) {
  if (!Number.isFinite(scrollY)) return;
  // Defer to let tab/theme content render before restoring position.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, behavior: "auto" });
    });
  });
}

function restoreTrainerReturnContext() {
  if (!trainerReturnContext) return false;
  const ctx = trainerReturnContext;
  trainerReturnContext = null;
  updateTrainerReturnControls();

  if (ctx.tab === "rules") {
    if (!rulesBuilt) {
      renderRulesThemes();
      rulesBuilt = true;
    }
    setActiveTab("rules");
    setRulesMode(ctx.rulesMode || "rule");
    if (ctx.rulesMode === "rule" && ctx.rulesThemeId) {
      selectRulesTheme(ctx.rulesThemeId);
    }
    if (ctx.rulesMode === "date" && ctx.dateThemeId) {
      selectDateTheme(ctx.dateThemeId);
    }
    restorePageScroll(ctx.scrollY);
    return true;
  }

  if (ctx.tab === "trainer") {
    setActiveTab("trainer");
    setTrainerMode(ctx.trainerMode || "classic");
    restorePageScroll(ctx.scrollY);
    return true;
  }

  setActiveTab(ctx.tab || "trainer");
  restorePageScroll(ctx.scrollY);
  return true;
}

function setupTrainerSwipe() {
  trainerSwipeAreaEl.addEventListener("touchstart", (event) => {
    const t = event.changedTouches?.[0];
    if (!t) return;
    const target = event.target;
    trainerSwipeIgnore = Boolean(
      target instanceof Element &&
      target.closest(".h-scroll-tabs, button, select, input, textarea, label, a")
    );
    if (trainerSwipeIgnore) return;
    trainerSwipeStartX = t.clientX;
    trainerSwipeStartY = t.clientY;
  }, { passive: true });

  trainerSwipeAreaEl.addEventListener("touchend", (event) => {
    if (trainerSwipeIgnore) {
      trainerSwipeIgnore = false;
      return;
    }
    const t = event.changedTouches?.[0];
    if (!t) return;
    const dx = t.clientX - trainerSwipeStartX;
    const dy = t.clientY - trainerSwipeStartY;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;

    const modes = ["classic", "theme", "anti-heur"];
    const currentIndex = modes.indexOf(trainerMode);
    if (dx < 0 && currentIndex < modes.length - 1) setTrainerMode(modes[currentIndex + 1]);
    if (dx > 0 && currentIndex > 0) setTrainerMode(modes[currentIndex - 1]);
  }, { passive: true });
}

function setRulesMode(mode) {
  // Keep Rules section UX aligned with Trainer: two competing sub-pages in one frame.
  rulesMode = mode === "date" ? "date" : "rule";
  const isRule = rulesMode === "rule";

  rulesModeRuleBtn.className = isRule ? "tab-btn active" : "tab-btn";
  rulesModeDateBtn.className = isRule ? "tab-btn" : "tab-btn active";
  rulesRulePanelEl.classList.toggle("hidden", !isRule);
  rulesDatePanelEl.classList.toggle("hidden", isRule);
  renderRulesModeIndicator();
}

function renderRulesModeIndicator() {
  if (!rulesModeIndicatorEl) return;
  // Two pages => move the indicator to left(0%) or right(100%) half.
  rulesModeIndicatorEl.style.transform = rulesMode === "date" ? "translateX(100%)" : "translateX(0%)";
}

function setupRulesSwipe() {
  rulesSwipeAreaEl.addEventListener("touchstart", (event) => {
    const t = event.changedTouches?.[0];
    if (!t) return;
    const target = event.target;
    rulesSwipeIgnore = Boolean(
      target instanceof Element &&
      target.closest(".h-scroll-tabs, button, select, input, textarea, label, a")
    );
    if (rulesSwipeIgnore) return;
    rulesSwipeStartX = t.clientX;
    rulesSwipeStartY = t.clientY;
  }, { passive: true });

  rulesSwipeAreaEl.addEventListener("touchend", (event) => {
    if (rulesSwipeIgnore) {
      rulesSwipeIgnore = false;
      return;
    }
    const t = event.changedTouches?.[0];
    if (!t) return;
    const dx = t.clientX - rulesSwipeStartX;
    const dy = t.clientY - rulesSwipeStartY;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) setRulesMode("date");
    if (dx > 0) setRulesMode("rule");
  }, { passive: true });
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

function openQuestionById(id, returnContext = null) {
  const nextIndex = questions.findIndex((q) => q.id === id);
  if (nextIndex < 0) return;

  trainerReturnContext = returnContext;
  index = nextIndex;
  renderQuestion();
  setTrainerMode("classic");
  setActiveTab("trainer");
  updateTrainerReturnControls();
}

function refreshThemeDrillThemes() {
  const sourceThemes = rulesThemes.length > 0 ? rulesThemes : buildRulesThemes().ruleThemes;
  const available = sourceThemes.filter((theme) => theme.questions?.length);
  themeTrainerTabsEl.innerHTML = "";

  if (!available.length) {
    activeTrainerThemeId = "";
    return;
  }

  if (!activeTrainerThemeId || !available.some((t) => t.id === activeTrainerThemeId)) {
    activeTrainerThemeId = available[0].id;
  }

  for (const theme of available) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = theme.id === activeTrainerThemeId ? "tab-btn active" : "tab-btn";
    btn.textContent = `${theme.title} (${theme.questions.length})`;
    btn.addEventListener("click", () => {
      activeTrainerThemeId = theme.id;
      refreshThemeDrillThemes();
    });
    themeTrainerTabsEl.appendChild(btn);
  }
}

function setThemeDrillFeedback(text, type = "") {
  themeDrillFeedbackEl.textContent = text;
  themeDrillFeedbackEl.className = `mt-2 min-h-6 text-sm ${type === "good" ? "text-appaccent" : type === "bad" ? "text-appdanger" : ""}`;
}

function clearThemeDrillTimers() {
  if (themeDrillState.autoNextTimeoutId) {
    clearTimeout(themeDrillState.autoNextTimeoutId);
    themeDrillState.autoNextTimeoutId = null;
  }
  if (themeDrillState.autoNextIntervalId) {
    clearInterval(themeDrillState.autoNextIntervalId);
    themeDrillState.autoNextIntervalId = null;
  }
}

function randomItem(items) {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)];
}

function startThemeDrill() {
  clearThemeDrillTimers();
  const themeId = activeTrainerThemeId;
  const sourceThemes = rulesThemes.length > 0 ? rulesThemes : buildRulesThemes().ruleThemes;
  const theme = sourceThemes.find((t) => t.id === themeId);
  if (!theme || !theme.questions?.length) {
    setThemeDrillFeedback("Тема не выбрана или в теме нет вопросов.", "bad");
    return;
  }

  // Learning loop: each question must have three consecutive correct answers.
  themeDrillState.active = true;
  themeDrillState.themeId = theme.id;
  themeDrillState.questionIds = theme.questions.map((q) => q.id);
  themeDrillState.streakById = new Map(themeDrillState.questionIds.map((id) => [id, 0]));
  themeDrillState.currentQuestionId = null;
  themeDrillState.answered = false;
  themeDrillState.autoNextTimeoutId = null;
  themeDrillState.autoNextIntervalId = null;
  setThemeDrillFeedback("");

  nextThemeDrillQuestion();
}

function themeDrillPendingIds() {
  return themeDrillState.questionIds.filter((id) => (themeDrillState.streakById.get(id) || 0) < 3);
}

function renderThemeDrillStats() {
  if (!themeDrillState.active) {
    themeDrillStatsEl.textContent = "Тренировка не запущена.";
    return;
  }
  const total = themeDrillState.questionIds.length;
  const mastered = themeDrillState.questionIds.filter((id) => (themeDrillState.streakById.get(id) || 0) >= 3).length;
  const pending = total - mastered;
  themeDrillStatsEl.textContent = `Освоено: ${mastered}/${total} • Осталось: ${pending} • Цель: 3 подряд на каждый вопрос`;
}

function renderThemeDrillCurrentQuestion() {
  renderThemeDrillStats();
  themeDrillOptionsEl.innerHTML = "";
  themeDrillNextBtn.disabled = true;
  themeDrillNextBtn.textContent = "Следующий вопрос";

  if (!themeDrillState.active) {
    themeDrillQuestionEl.textContent = "Выберите тему и нажмите «Начать тренировку».";
    return;
  }

  if (!themeDrillState.currentQuestionId) {
    themeDrillQuestionEl.textContent = "Тренировка завершена.";
    themeDrillNextBtn.disabled = true;
    return;
  }

  const q = questions.find((x) => x.id === themeDrillState.currentQuestionId);
  if (!q) return;
  const streak = themeDrillState.streakById.get(q.id) || 0;
  themeDrillQuestionEl.textContent = `${q.id}. ${q.text} (серия: ${streak}/3)`;

  q.answers.forEach((answer, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "exam-option";
    btn.textContent = `${answerPrefix(i)} ${answer}`;
    btn.disabled = themeDrillState.answered;
    btn.addEventListener("click", () => submitThemeDrillAnswer(i));
    themeDrillOptionsEl.appendChild(btn);
  });
}

function submitThemeDrillAnswer(selectedIndex) {
  if (!themeDrillState.active || themeDrillState.answered || !themeDrillState.currentQuestionId) return;
  const q = questions.find((x) => x.id === themeDrillState.currentQuestionId);
  if (!q) return;

  themeDrillState.answered = true;
  const buttons = [...themeDrillOptionsEl.querySelectorAll(".exam-option")];
  buttons.forEach((btn) => (btn.disabled = true));

  if (selectedIndex === q.correctIndex) {
    const nextStreak = Math.min(3, (themeDrillState.streakById.get(q.id) || 0) + 1);
    themeDrillState.streakById.set(q.id, nextStreak);
    if (buttons[selectedIndex]) buttons[selectedIndex].classList.add("correct");
    setThemeDrillFeedback("Верно. Серия увеличена.", "good");
  } else {
    themeDrillState.streakById.set(q.id, 0);
    if (buttons[selectedIndex]) buttons[selectedIndex].classList.add("incorrect");
    if (buttons[q.correctIndex]) buttons[q.correctIndex].classList.add("correct");
    setThemeDrillFeedback("Неверно. Серия по вопросу сброшена до 0.", "bad");
  }

  renderThemeDrillStats();
  themeDrillNextBtn.disabled = false;
  let remaining = 3;
  themeDrillNextBtn.textContent = `Следующий вопрос (${remaining})`;
  themeDrillState.autoNextIntervalId = setInterval(() => {
    remaining -= 1;
    if (remaining > 0) {
      themeDrillNextBtn.textContent = `Следующий вопрос (${remaining})`;
      return;
    }
    clearInterval(themeDrillState.autoNextIntervalId);
    themeDrillState.autoNextIntervalId = null;
  }, 1000);

  themeDrillState.autoNextTimeoutId = setTimeout(() => {
    themeDrillState.autoNextTimeoutId = null;
    nextThemeDrillQuestion();
  }, 3000);
}

function nextThemeDrillQuestion() {
  if (!themeDrillState.active) return;
  clearThemeDrillTimers();

  const pending = themeDrillPendingIds();
  if (pending.length === 0) {
    themeDrillState.currentQuestionId = null;
    themeDrillState.answered = false;
    renderThemeDrillCurrentQuestion();
    setThemeDrillFeedback("Тема закреплена: на каждый вопрос получено 3 подряд верных ответа.", "good");
    return;
  }

  // Wrong-answered questions naturally return to the random pool until streak reaches 3.
  let nextId = randomItem(pending);
  if (pending.length > 1 && nextId === themeDrillState.currentQuestionId) {
    const others = pending.filter((id) => id !== themeDrillState.currentQuestionId);
    nextId = randomItem(others) ?? nextId;
  }

  themeDrillState.currentQuestionId = nextId;
  themeDrillState.answered = false;
  setThemeDrillFeedback("");
  renderThemeDrillCurrentQuestion();
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

function isDateQuestion(q) {
  const t = q.text.toLowerCase();
  const a = q.answers[q.correctIndex].toLowerCase();
  return /срок|сроки|в какие сроки|продолжительность сезона|осуществляется охота|с\s+\d{1,2}|по\s+\d{1,2}/i.test(t + " " + a);
}

function isMemorizationDateQuestion(q) {
  const combined = `${q.text} ${q.answers[q.correctIndex]}`.toLowerCase();
  // Questions that are primarily factual date/duration recall.
  return (
    /в какие сроки/i.test(combined) ||
    /срок охоты/i.test(combined) ||
    /продолжительность сезона/i.test(combined) ||
    /с\s+\d{1,2}\s+[а-яё]+\s+по\s+\d{1,2}\s+[а-яё]+/i.test(combined) ||
    /по\s+\d{1,2}\s+[а-яё]+/i.test(combined)
  );
}

function buildRulesThemes() {
  const ruleThemes = [];
  const builtDateThemes = [];

  RULE_GROUPS.forEach((group, idx) => {
    const matched = questions.filter((q) => group.matcher(q)).sort((a, b) => a.id - b.id);
    if (matched.length === 0) return;
    ruleThemes.push({
      id: `rule-${idx}`,
      kind: "rule",
      title: group.title,
      description: group.description,
      questions: matched,
    });
  });

  const dateQuestions = questions.filter((q) => isDateQuestion(q)).sort((a, b) => a.id - b.id);
  if (dateQuestions.length > 0) {
    // Dates are grouped by semantic category to avoid one long, noisy list.
    const byCategory = new Map();
    for (const q of dateQuestions) {
      const category = inferDateCategory(q);
      const list = byCategory.get(category) || [];
      list.push(q);
      byCategory.set(category, list);
    }
    for (const [category, list] of byCategory.entries()) {
      builtDateThemes.push({
        id: `date-${category.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-")}`,
        kind: "date",
        title: category,
        description: "Вопросы по срокам и периодам охоты в контексте объекта.",
        questions: list.sort((a, b) => a.id - b.id),
      });
    }
  }

  return { ruleThemes, dateThemes: builtDateThemes };
}

function renderRulesThemes() {
  const built = buildRulesThemes();
  rulesThemes = built.ruleThemes;
  dateThemes = built.dateThemes;

  rulesTopicTabsEl.innerHTML = "";
  rulesTopicContentEl.innerHTML = "";
  rulesTopicMetaEl.textContent = "";
  dateTopicTabsEl.innerHTML = "";
  dateTopicContentEl.innerHTML = "";
  dateTopicMetaEl.textContent = "";

  if (rulesThemes.length === 0 && dateThemes.length === 0) {
    rulesTopicMetaEl.textContent = "Нет доступных тематических блоков.";
    return;
  }

  for (const theme of rulesThemes) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab-btn";
    btn.textContent = theme.title;
    btn.addEventListener("click", () => selectRulesTheme(theme.id));
    rulesTopicTabsEl.appendChild(btn);
  }
  for (const theme of dateThemes) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab-btn";
    btn.textContent = theme.title;
    btn.addEventListener("click", () => selectDateTheme(theme.id));
    dateTopicTabsEl.appendChild(btn);
  }

  if (rulesThemes.length > 0) {
    activeRulesThemeId = rulesThemes[0].id;
    selectRulesTheme(activeRulesThemeId);
  }
  if (dateThemes.length > 0) {
    activeDateThemeId = dateThemes[0].id;
    selectDateTheme(activeDateThemeId);
  }
  setRulesMode("rule");
  refreshThemeDrillThemes();
}

function selectRulesTheme(themeId) {
  activeRulesThemeId = themeId;
  const buttons = [...rulesTopicTabsEl.querySelectorAll(".tab-btn")];
  buttons.forEach((btn, i) => {
    const theme = rulesThemes[i];
    btn.className = theme && theme.id === themeId ? "tab-btn active" : "tab-btn";
  });
  renderRulesThemeContent(themeId);
}

function renderRulesThemeContent(themeId) {
  const theme = rulesThemes.find((t) => t.id === themeId);
  rulesTopicContentEl.innerHTML = "";
  if (!theme) return;

  rulesTopicMetaEl.textContent = `${theme.description} • ${theme.questions.length} вопросов`;
  for (const q of theme.questions) {
    const row = document.createElement("article");
    row.className = "rounded-lg border border-slate-700 bg-slate-900/30 p-3";

    const head = document.createElement("div");
    head.className = "flex flex-wrap items-center justify-between gap-2";

    const title = document.createElement("strong");
    title.className = "text-sm font-semibold";
    title.textContent = q.text;

    const id = document.createElement("span");
    id.className = "text-xs text-appmuted";
    id.textContent = `#${q.id}`;

    const context = document.createElement("p");
    context.className = "mt-1 text-xs text-appmuted";
    context.textContent = `${inferObjectLabel(q)} • ${inferNormType(q)}`;

    const answerText = document.createElement("p");
    answerText.className = "mt-2 text-sm";
    answerText.textContent =
      theme.kind === "date"
        ? `Период: ${extractPeriodText(q.answers[q.correctIndex])}`
        : `Правильный ответ: ${q.answers[q.correctIndex]}`;

    const actions = document.createElement("div");
    actions.className = "mt-2";
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "item-link";
    openBtn.textContent = `К вопросу #${q.id}`;
    openBtn.addEventListener("click", () =>
      openQuestionById(q.id, {
        tab: "rules",
        rulesMode: "rule",
        rulesThemeId: activeRulesThemeId,
        label: "правилам",
        scrollY: window.scrollY,
      })
    );
    actions.appendChild(openBtn);

    head.append(title, id);
    row.append(head, context, answerText, actions);
    rulesTopicContentEl.appendChild(row);
  }
}

function selectDateTheme(themeId) {
  activeDateThemeId = themeId;
  const buttons = [...dateTopicTabsEl.querySelectorAll(".tab-btn")];
  buttons.forEach((btn, i) => {
    const theme = dateThemes[i];
    btn.className = theme && theme.id === themeId ? "tab-btn active" : "tab-btn";
  });
  renderDateThemeContent(themeId);
}

function renderDateThemeContent(themeId) {
  const theme = dateThemes.find((t) => t.id === themeId);
  dateTopicContentEl.innerHTML = "";
  if (!theme) return;

  dateTopicMetaEl.textContent = `${theme.description} • ${theme.questions.length} вопросов`;
  for (const q of theme.questions) {
    const row = document.createElement("article");
    row.className = "rounded-lg border border-slate-700 bg-slate-900/30 p-3";

    const head = document.createElement("div");
    head.className = "flex flex-wrap items-center justify-between gap-2";

    const title = document.createElement("strong");
    title.className = "text-sm font-semibold";
    title.textContent = q.text;

    const id = document.createElement("span");
    id.className = "text-xs text-appmuted";
    id.textContent = `#${q.id}`;

    const context = document.createElement("p");
    context.className = "mt-1 text-xs text-appmuted";
    context.textContent = `${inferObjectLabel(q)} • ${inferDateCategory(q)}`;

    const answerText = document.createElement("p");
    answerText.className = "mt-2 text-sm";
    answerText.textContent = `Период: ${extractPeriodText(q.answers[q.correctIndex])}`;

    const actions = document.createElement("div");
    actions.className = "mt-2";
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "item-link";
    openBtn.textContent = `К вопросу #${q.id}`;
    openBtn.addEventListener("click", () =>
      openQuestionById(q.id, {
        tab: "rules",
        rulesMode: "date",
        dateThemeId: activeDateThemeId,
        label: "датам",
        scrollY: window.scrollY,
      })
    );
    actions.appendChild(openBtn);

    head.append(title, id);
    row.append(head, context, answerText, actions);
    dateTopicContentEl.appendChild(row);
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

async function fetchStaticPair(cacheBust = "") {
  const suffix = cacheBust ? `?v=${encodeURIComponent(cacheBust)}` : "";
  const [bankResp, hashResp] = await Promise.all([
    fetch(`${dataUrl("official_bank.json")}${suffix}`, { cache: "no-store" }),
    fetch(`${dataUrl("official_bank.hash")}${suffix}`, { cache: "no-store" }),
  ]);
  return { bankResp, hashResp };
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
  const attempts = ["", String(Date.now())];
  let lastError = new Error("Static official files missing");

  for (const bust of attempts) {
    try {
      const { bankResp, hashResp } = await fetchStaticPair(bust);
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
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError;
}

function shuffled(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function clearExamTimers() {
  if (examState.autoNextTimeoutId) {
    clearTimeout(examState.autoNextTimeoutId);
    examState.autoNextTimeoutId = null;
  }
  if (examState.autoNextIntervalId) {
    clearInterval(examState.autoNextIntervalId);
    examState.autoNextIntervalId = null;
  }
  if (examState.statsTickerId) {
    clearInterval(examState.statsTickerId);
    examState.statsTickerId = null;
  }
}

function formatDurationMs(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function elapsedMs() {
  if (!examState.startedAt) return 0;
  return (examState.finishedAt || Date.now()) - examState.startedAt;
}

function remainingMs() {
  return Math.max(0, examState.durationMs - elapsedMs());
}

function questionRemainingMs() {
  if (!examState.questionStartedAt) return 0;
  return Math.max(0, examState.questionDurationMs - (Date.now() - examState.questionStartedAt));
}

function normalizeQuestionCount(rawCount) {
  // Regulatory constraint: exam set must include from 100 to 200 questions.
  const safeCount = Number.isFinite(rawCount) ? Math.trunc(rawCount) : 100;
  return Math.max(100, Math.min(200, safeCount));
}

function normalizeMinutesPerQuestion(rawValue) {
  // Regulatory constraint: at least 1 minute per question.
  const safe = Number.isFinite(rawValue) ? Math.trunc(rawValue) : 1;
  return Math.max(1, safe);
}

function passingScore(total) {
  // Passing rule: at least 75% of maximum possible points.
  return Math.ceil(total * 0.75);
}

function normalizeQuestionText(text) {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function antiHeuristicReason(q) {
  const lengths = q.answers.map((a) => a.replace(/\s+/g, " ").trim().length);
  const maxLen = Math.max(...lengths);
  const isLongestOrTie = lengths[q.correctIndex] === maxLen;
  const isUniqueLongest = isLongestOrTie && lengths.filter((len) => len === maxLen).length === 1;
  const reasons = [];
  if (q.correctIndex !== 1) reasons.push("правильный не в позиции б");
  if (isUniqueLongest) {
    reasons.push("правильный уникально самый длинный (исключается)");
  } else {
    reasons.push("правильный не уникально самый длинный");
  }
  return reasons;
}

function buildAntiHeuristicQuestions() {
  // Strict anti-heuristic pool:
  // correct answer is NOT "б" and is NOT uniquely longest
  // (i.e. it is shorter, or tied by length with another option).
  return questions
    .filter((q) => {
      const lengths = q.answers.map((a) => a.replace(/\s+/g, " ").trim().length);
      const maxLen = Math.max(...lengths);
      const isLongestOrTie = lengths[q.correctIndex] === maxLen;
      const isUniqueLongest = isLongestOrTie && lengths.filter((len) => len === maxLen).length === 1;
      const isB = q.correctIndex === 1;
      return !isB && !isUniqueLongest;
    })
    .sort((a, b) => a.id - b.id);
}

function renderAntiHeuristicPanel() {
  antiHeurListEl.innerHTML = "";
  if (!antiHeuristicQuestions.length) {
    antiHeurMetaEl.textContent = "Все вопросы попали под эвристику — анти-эвристический список пуст.";
    return;
  }

  antiHeurMetaEl.textContent = `Вопросов для анти-эвристической тренировки: ${antiHeuristicQuestions.length} из ${questions.length}`;
  for (const q of antiHeuristicQuestions) {
    const row = document.createElement("article");
    row.className = "rounded-lg border border-slate-700 bg-slate-900/30 p-3";

    const title = document.createElement("p");
    title.className = "text-sm";
    title.textContent = `${q.id}. ${q.text}`;

    const reason = document.createElement("p");
    reason.className = "mt-1 text-xs text-appmuted";
    reason.textContent = `Почему здесь: ${antiHeuristicReason(q).join(" + ") || "анти-эвристический критерий"}`;

    const answerText = document.createElement("p");
    answerText.className = "mt-2 text-sm";
    answerText.textContent = `Правильный ответ (${answerPrefix(q.correctIndex)}): ${q.answers[q.correctIndex]}`;

    const actions = document.createElement("div");
    actions.className = "mt-2";
    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "item-link";
    openBtn.textContent = `Открыть вопрос #${q.id}`;
    openBtn.addEventListener("click", () =>
      openQuestionById(q.id, {
        tab: "trainer",
        trainerMode: "anti-heur",
        label: "анти-эвристикам",
        scrollY: window.scrollY,
      })
    );
    actions.appendChild(openBtn);

    row.append(title, reason, answerText, actions);
    antiHeurListEl.appendChild(row);
  }
}

function buildExamQueue(allIndexes, mode, targetCount) {
  const orderedIndexes = mode === "random" ? shuffled(allIndexes) : allIndexes;
  const usedIndexes = new Set();
  const usedTexts = new Set();
  const queue = [];

  // Hard guarantee for one exam attempt: no repeated question index and no repeated question text.
  for (const idx of orderedIndexes) {
    if (queue.length >= targetCount) break;
    if (usedIndexes.has(idx)) continue;

    const q = questions[idx];
    if (!q) continue;
    const key = normalizeQuestionText(q.text);
    if (usedTexts.has(key)) continue;

    usedIndexes.add(idx);
    usedTexts.add(key);
    queue.push(idx);
  }

  return queue;
}

function startExam() {
  clearExamTimers();
  examState.started = true;
  examState.orderMode = examOrderEl.value;
  examState.questionCount = normalizeQuestionCount(Number(examCountEl.value));
  examState.minutesPerQuestion = normalizeMinutesPerQuestion(Number(minutesPerQuestionEl.value));
  examState.durationMs = examState.questionCount * examState.minutesPerQuestion * 60 * 1000;
  examState.questionDurationMs = examState.minutesPerQuestion * 60 * 1000;

  const cappedCount = Math.min(examState.questionCount, questions.length);
  const allIndexes = questions.map((_, i) => i);
  examState.queue = buildExamQueue(allIndexes, examState.orderMode, cappedCount);

  examState.position = 0;
  examState.correct = 0;
  examState.answered = false;
  examState.startedAt = Date.now();
  examState.finishedAt = 0;
  examState.finishedReason = "";
  examState.questionStartedAt = 0;

  examCountEl.value = String(examState.questionCount);
  minutesPerQuestionEl.value = String(examState.minutesPerQuestion);

  examState.statsTickerId = setInterval(() => {
    if (remainingMs() <= 0) {
      finalizeExam("Время истекло.");
      return;
    }
    if (!examState.answered && questionRemainingMs() <= 0 && examState.position < examState.queue.length) {
      handleQuestionTimeout();
      return;
    }
    renderExamStats();
    renderQuestionTimer();
  }, 1000);
  renderExam();
  if (examState.queue.length < examState.questionCount) {
    // If source contains repeated wording, we keep non-repeating set for exam integrity.
    setFeedback(
      `Собрано ${examState.queue.length} уникальных вопросов по тексту вместо ${examState.questionCount}.`,
      "bad"
    );
  }
}

function currentExamQuestion() {
  const idx = examState.queue[examState.position];
  return questions[idx] || null;
}

function renderExamStats() {
  if (!examState.started) {
    examStatsEl.textContent = "Экзамен не запущен.";
    return;
  }
  const total = examState.queue.length;
  const current = total ? Math.min(examState.position + 1, total) : 0;
  const answeredCount = examState.position + (examState.answered ? 1 : 0);
  const left = formatDurationMs(remainingMs());
  const needed = passingScore(total);
  examStatsEl.textContent = `Вопрос ${current} / ${total} • Отвечено: ${answeredCount} • Верных: ${examState.correct} • Для сдачи: ${needed} • Осталось: ${left}`;
  renderExamProgress();
}

function renderExamProgress() {
  const total = examState.queue.length || 1;
  const answeredCount = examState.position + (examState.answered ? 1 : 0);
  const progressPct = Math.max(0, Math.min(100, (answeredCount / total) * 100));
  examProgressBarEl.style.width = `${progressPct.toFixed(2)}%`;
}

function renderQuestionTimer() {
  if (!examState.started || examState.finishedAt || examState.position >= examState.queue.length) {
    examQuestionTimerEl.textContent = "";
    return;
  }
  if (examState.answered) {
    examQuestionTimerEl.textContent = "";
    return;
  }
  examQuestionTimerEl.textContent = `На текущий вопрос осталось: ${formatDurationMs(questionRemainingMs())}`;
}

function setFeedback(text, type = "") {
  examFeedbackEl.textContent = text;
  examFeedbackEl.className = `mt-3 min-h-6 text-sm ${type === "good" ? "text-appaccent" : type === "bad" ? "text-appdanger" : ""}`;
}

function renderExam() {
  if (!examState.started) {
    renderExamIdle();
    return;
  }

  renderExamStats();
  examState.questionStartedAt = Date.now();
  renderQuestionTimer();
  examOptionsEl.innerHTML = "";
  examNextBtn.disabled = true;
  examNextBtn.textContent = "Далее";
  setFeedback("");

  if (examState.position >= examState.queue.length) {
    finalizeExam("Тестирование завершено.");
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

function renderExamIdle() {
  clearExamTimers();
  examState.queue = [];
  examState.position = 0;
  examState.correct = 0;
  examState.answered = false;
  examState.startedAt = 0;
  examState.finishedAt = 0;
  examState.finishedReason = "";
  examState.questionStartedAt = 0;

  examStatsEl.textContent = "Экзамен не запущен.";
  examQuestionTimerEl.textContent = "";
  examQuestionEl.textContent = "Выберите параметры и нажмите «Начать экзамен».";
  examOptionsEl.innerHTML = "";
  setFeedback("");
  examProgressBarEl.style.width = "0%";
  examNextBtn.disabled = true;
  examNextBtn.textContent = "Далее";
}

function applyExamResultStyles(_q, selected) {
  const buttons = [...examOptionsEl.querySelectorAll(".exam-option")];
  buttons.forEach((btn, i) => {
    btn.disabled = true;
    if (i === selected) {
      btn.classList.add("incorrect");
    }
  });
}

function submitExamAnswer(selectedIndex) {
  if (examState.answered || examState.position >= examState.queue.length || examState.finishedAt) return;

  examState.answered = true;
  const q = currentExamQuestion();
  if (!q) return;

  if (selectedIndex === q.correctIndex) {
    examState.correct += 1;
    setFeedback("Верно.", "good");
  } else {
    setFeedback("Неверно.", "bad");
  }

  applyExamResultStyles(q, selectedIndex);
  if (selectedIndex !== q.correctIndex) {
    const buttons = [...examOptionsEl.querySelectorAll(".exam-option")];
    const rightBtn = buttons[q.correctIndex];
    if (rightBtn) {
      rightBtn.classList.remove("incorrect");
      rightBtn.classList.add("correct");
    }
  } else {
    const buttons = [...examOptionsEl.querySelectorAll(".exam-option")];
    const selectedBtn = buttons[selectedIndex];
    if (selectedBtn) {
      selectedBtn.classList.remove("incorrect");
      selectedBtn.classList.add("correct");
    }
  }
  examNextBtn.disabled = false;
  renderExamStats();
  renderQuestionTimer();

  let remaining = 3;
  examNextBtn.textContent = `Далее (${remaining})`;
  examState.autoNextIntervalId = setInterval(() => {
    remaining -= 1;
    if (remaining > 0) {
      examNextBtn.textContent = `Далее (${remaining})`;
      return;
    }
    clearInterval(examState.autoNextIntervalId);
    examState.autoNextIntervalId = null;
  }, 1000);

  examState.autoNextTimeoutId = setTimeout(() => {
    examState.autoNextTimeoutId = null;
    nextExamQuestion();
  }, 3000);
}

function nextExamQuestion() {
  if (!examState.started || !examState.answered || examState.finishedAt) return;
  if (examState.autoNextTimeoutId) {
    clearTimeout(examState.autoNextTimeoutId);
    examState.autoNextTimeoutId = null;
  }
  if (examState.autoNextIntervalId) {
    clearInterval(examState.autoNextIntervalId);
    examState.autoNextIntervalId = null;
  }
  examState.position += 1;
  examState.answered = false;
  renderExam();
}

function handleQuestionTimeout() {
  if (!examState.started || examState.answered || examState.finishedAt || examState.position >= examState.queue.length) return;
  examState.answered = true;
  setFeedback("Время на вопрос истекло. Ответ засчитан как неверный.", "bad");

  const buttons = [...examOptionsEl.querySelectorAll(".exam-option")];
  buttons.forEach((btn) => {
    btn.disabled = true;
    btn.classList.add("strike");
  });
  const q = currentExamQuestion();
  if (q && buttons[q.correctIndex]) {
    buttons[q.correctIndex].classList.remove("strike");
    buttons[q.correctIndex].classList.add("correct");
  }

  examNextBtn.disabled = false;
  renderExamStats();
  renderQuestionTimer();

  let remaining = 3;
  examNextBtn.textContent = `Далее (${remaining})`;
  examState.autoNextIntervalId = setInterval(() => {
    remaining -= 1;
    if (remaining > 0) {
      examNextBtn.textContent = `Далее (${remaining})`;
      return;
    }
    clearInterval(examState.autoNextIntervalId);
    examState.autoNextIntervalId = null;
  }, 1000);
  examState.autoNextTimeoutId = setTimeout(() => {
    examState.autoNextTimeoutId = null;
    nextExamQuestion();
  }, 3000);
}

function finalizeExam(reason) {
  if (!examState.started || examState.finishedAt) return;

  examState.finishedAt = Date.now();
  examState.finishedReason = reason;
  clearExamTimers();

  const total = examState.queue.length;
  const percent = total ? ((examState.correct / total) * 100).toFixed(1) : "0.0";
  const needed = passingScore(total);
  const passed = examState.correct >= needed;
  const elapsed = formatDurationMs(elapsedMs());

  examOptionsEl.innerHTML = "";
  examNextBtn.disabled = true;
  setFeedback("");
  examQuestionTimerEl.textContent = "";
  renderExamStats();
  examProgressBarEl.style.width = "100%";
  examQuestionEl.textContent = `${reason} Результат: ${examState.correct} из ${total} (${percent}%). Проходной балл: ${needed}. Статус: ${passed ? "СДАНО" : "НЕ СДАНО"}. Затраченное время: ${elapsed}.`;
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
  const memorizationDateQuestions = questions.filter((q) => isMemorizationDateQuestion(q));
  const memorizationDateCount = memorizationDateQuestions.length;
  const memorizationByPosition = [0, 0, 0];

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
  for (const q of memorizationDateQuestions) {
    memorizationByPosition[q.correctIndex] += 1;
  }

  const block = document.createElement("article");
  block.className = "rounded-xl border border-slate-700 bg-slate-900/30 p-4";
  block.innerHTML = `
    <p class="text-sm">По вашему текущему банку (${total} вопросов):</p>
    <ul class="mt-2 list-disc space-y-1 pl-5 text-sm">
      <li>вопросы на заучивание конкретных дат/сроков: <strong>${memorizationDateCount} / ${total}</strong> (≈ ${pct(memorizationDateCount, total)}%)</li>
    </ul>
    <ul class="mt-2 list-disc space-y-1 pl-5 text-sm">
      <li>распределение правильных внутри этих вопросов: а — <strong>${memorizationByPosition[0]}</strong> (${pct(memorizationByPosition[0], memorizationDateCount)}%), б — <strong>${memorizationByPosition[1]}</strong> (${pct(memorizationByPosition[1], memorizationDateCount)}%), в — <strong>${memorizationByPosition[2]}</strong> (${pct(memorizationByPosition[2], memorizationDateCount)}%)</li>
    </ul>
    <p class="mt-3 text-xs text-appmuted">Критерий: вопросы о сроках начала/окончания охоты и длительности сезона.</p>
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

    // We keep first paint fast and postpone heavy lists until the corresponding tab is opened.
    rulesBuilt = false;
    insightsBuilt = false;
    const builtThemes = buildRulesThemes();
    rulesThemes = builtThemes.ruleThemes;
    dateThemes = builtThemes.dateThemes;
    antiHeuristicQuestions = buildAntiHeuristicQuestions();
    refreshThemeDrillThemes();
    renderAntiHeuristicPanel();
    renderQuestion();
    renderExamIdle();
    renderThemeDrillStats();
    renderThemeDrillCurrentQuestion();
    setTrainerMode("classic");
    setActiveTab("trainer");
  } catch {
    renderNotReady();
  }
}

prevBtn.addEventListener("click", () => {
  if (restoreTrainerReturnContext()) return;
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

backToRulesBtn.addEventListener("click", () => {
  if (!restoreTrainerReturnContext()) {
    setActiveTab("rules");
  }
});
startThemeDrillBtn.addEventListener("click", () => startThemeDrill());
themeDrillNextBtn.addEventListener("click", () => nextThemeDrillQuestion());
trainerModeClassicBtn.addEventListener("click", () => setTrainerMode("classic"));
trainerModeThemeBtn.addEventListener("click", () => setTrainerMode("theme"));
trainerModeAntiHeurBtn.addEventListener("click", () => setTrainerMode("anti-heur"));
rulesModeRuleBtn.addEventListener("click", () => setRulesMode("rule"));
rulesModeDateBtn.addEventListener("click", () => setRulesMode("date"));

tabTrainerBtn.addEventListener("click", () => setActiveTab("trainer"));
tabRulesBtn.addEventListener("click", () => setActiveTab("rules"));
tabExamBtn.addEventListener("click", () => setActiveTab("exam"));
tabInsightsBtn.addEventListener("click", () => setActiveTab("insights"));

restartExamBtn.addEventListener("click", () => startExam());
examNextBtn.addEventListener("click", () => nextExamQuestion());
finishExamBtn.addEventListener("click", () => finalizeExam("Экзамен завершен досрочно."));

setupTrainerSwipe();
setupRulesSwipe();

bootstrap();
checkBuildUpdateBadge();
