/**
 * app.js
 * Side-by-side evaluation of two AI responses:
 * rubric scores (1–5) for each response, overall preference, written justification,
 * progress saved in the browser, results summary and export to CSV / JSON.
 */

// ---------- Configuration ----------
const CRITERIA = [
  { id: "accuracy", label: "Accuracy", help: "Facts, calculations and code are correct" },
  { id: "instructions", label: "Instruction following", help: "Does exactly what the prompt asks" },
  { id: "clarity", label: "Clarity", help: "Well organized and easy to understand" },
  { id: "helpfulness", label: "Helpfulness", help: "Useful and complete for the user" },
];

const PREFERENCES = [
  { value: "A_much", label: "A is much better", winner: "A" },
  { value: "A_slight", label: "A is slightly better", winner: "A" },
  { value: "tie", label: "About the same", winner: "tie" },
  { value: "B_slight", label: "B is slightly better", winner: "B" },
  { value: "B_much", label: "B is much better", winner: "B" },
];

const MIN_JUSTIFICATION = 30;
const STORAGE_KEY = "ai-response-rater:v1";

// ---------- State ----------
const state = {
  tasks: SAMPLE_TASKS,
  current: 0,
  annotations: {}, // taskId -> { scores: {A: {...}, B: {...}}, preference, justification, savedAt }
};

// ---------- DOM helpers ----------
const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === "text") node.textContent = value;
    else if (key === "className") node.className = value;
    else node.setAttribute(key, value);
  });
  children.forEach((child) => node.append(child));
  return node;
}

// ---------- Persistence (localStorage can fail in private mode, so it is wrapped) ----------
function saveProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks: state.tasks, annotations: state.annotations, current: state.current }));
  } catch {
    /* Saving is optional: the app keeps working in memory. */
  }
}

function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.tasks) && saved.tasks.length) {
      state.tasks = saved.tasks;
      state.annotations = saved.annotations || {};
      state.current = Math.min(saved.current || 0, saved.tasks.length - 1);
    }
  } catch {
    /* Ignore corrupted or unavailable storage. */
  }
}

// ---------- Building the rubric and preference controls ----------
function buildRubric(side) {
  const container = $(`rubric-${side}`);
  container.innerHTML = "";
  CRITERIA.forEach((criterion) => {
    const scale = el("fieldset", { className: "scale", "aria-label": `${criterion.label} score for response ${side}` });
    for (let score = 1; score <= 5; score++) {
      const input = el("input", { type: "radio", name: `${side}-${criterion.id}`, value: String(score) });
      scale.append(el("label", { title: `${score} of 5` }, [input, el("span", { text: String(score) })]));
    }
    const label = el("div", { className: "rubric__label", text: criterion.label }, [el("small", { text: criterion.help })]);
    container.append(el("div", { className: "rubric__row" }, [label, scale]));
  });
}

function buildPreference() {
  const container = $("preference");
  PREFERENCES.forEach((pref) => {
    const input = el("input", { type: "radio", name: "preference", value: pref.value });
    container.append(el("label", {}, [input, el("span", { text: pref.label })]));
  });
}

// ---------- Rendering a task ----------
function renderTask() {
  const task = state.tasks[state.current];
  const saved = state.annotations[task.id];

  $("task-category").textContent = task.category || "General";
  $("task-category").hidden = false;
  $("task-prompt").textContent = task.prompt;
  $("response-A").textContent = task.responseA;
  $("response-B").textContent = task.responseB;

  // Restore saved answers, or clear the form.
  document.querySelectorAll("#task-view input[type=radio]").forEach((input) => (input.checked = false));
  if (saved) {
    ["A", "B"].forEach((side) =>
      CRITERIA.forEach((c) => {
        const input = document.querySelector(`input[name="${side}-${c.id}"][value="${saved.scores[side][c.id]}"]`);
        if (input) input.checked = true;
      })
    );
    const pref = document.querySelector(`input[name="preference"][value="${saved.preference}"]`);
    if (pref) pref.checked = true;
  }
  $("justification").value = saved ? saved.justification : "";
  updateCharCount();
  hideValidation();

  $("prev-btn").disabled = state.current === 0;
  $("next-btn").textContent = state.current === state.tasks.length - 1 ? "Save & view results" : "Save & next →";
  renderProgress();
}

function renderProgress() {
  const total = state.tasks.length;
  const done = state.tasks.filter((t) => state.annotations[t.id]).length;

  $("progress-label").textContent = `Task ${state.current + 1} of ${total}`;
  $("progress-done").textContent = `${done} completed`;
  $("progress-fill").style.width = `${(done / total) * 100}%`;

  const nav = $("task-nav");
  nav.innerHTML = "";
  state.tasks.forEach((task, i) => {
    const button = el("button", { type: "button", text: String(i + 1), "aria-label": `Go to task ${i + 1}` });
    if (state.annotations[task.id]) button.classList.add("is-done");
    if (i === state.current) {
      button.classList.add("is-current");
      button.setAttribute("aria-current", "step");
    }
    button.addEventListener("click", () => goTo(i));
    nav.append(button);
  });
}

// ---------- Reading and validating the form ----------
function readForm() {
  const scores = { A: {}, B: {} };
  const missing = [];

  ["A", "B"].forEach((side) =>
    CRITERIA.forEach((c) => {
      const checked = document.querySelector(`input[name="${side}-${c.id}"]:checked`);
      if (checked) scores[side][c.id] = Number(checked.value);
      else missing.push(`${c.label} (${side})`);
    })
  );

  const preference = document.querySelector('input[name="preference"]:checked')?.value;
  const justification = $("justification").value.trim();

  const errors = [];
  if (missing.length) errors.push(`Missing scores: ${missing.join(", ")}.`);
  if (!preference) errors.push("Choose an overall preference.");
  if (justification.length < MIN_JUSTIFICATION) errors.push(`The justification needs at least ${MIN_JUSTIFICATION} characters.`);

  // Consistency check, a common quality rule in annotation projects:
  // the preferred response should not have a lower average score.
  if (!missing.length && preference) {
    const avgA = average(Object.values(scores.A));
    const avgB = average(Object.values(scores.B));
    const winner = PREFERENCES.find((p) => p.value === preference).winner;
    if ((winner === "A" && avgA < avgB) || (winner === "B" && avgB < avgA)) {
      errors.push(`Your preference (${winner}) does not match the rubric: A averages ${avgA.toFixed(2)} and B averages ${avgB.toFixed(2)}. Please review your scores.`);
    }
  }

  return { errors, annotation: { scores, preference, justification, savedAt: new Date().toISOString() } };
}

function average(values) {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : NaN;
}

function showValidation(errors) {
  const box = $("validation");
  box.innerHTML = "";
  errors.forEach((message) => box.append(el("span", { text: message }), el("br")));
  box.hidden = false;
}

function hideValidation() {
  $("validation").hidden = true;
}

function updateCharCount() {
  const length = $("justification").value.trim().length;
  $("char-count").textContent = `${length} characters${length < MIN_JUSTIFICATION ? ` (minimum ${MIN_JUSTIFICATION})` : ""}`;
}

// ---------- Navigation ----------
function goTo(index) {
  state.current = index;
  saveProgress();
  showView("task");
  renderTask();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function saveAndNext() {
  const { errors, annotation } = readForm();
  if (errors.length) {
    showValidation(errors);
    return;
  }
  state.annotations[state.tasks[state.current].id] = annotation;
  saveProgress();

  if (state.current < state.tasks.length - 1) goTo(state.current + 1);
  else showResults();
}

function showView(view) {
  $("task-view").hidden = view !== "task";
  $("results-view").hidden = view !== "results";
}

// ---------- Results ----------
function showResults() {
  showView("results");
  renderResults();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderResults() {
  const done = state.tasks.filter((t) => state.annotations[t.id]);
  const winners = done.map((t) => PREFERENCES.find((p) => p.value === state.annotations[t.id].preference).winner);

  $("kpi-done").textContent = `${done.length}/${state.tasks.length}`;
  $("kpi-a").textContent = winners.filter((w) => w === "A").length;
  $("kpi-b").textContent = winners.filter((w) => w === "B").length;
  $("kpi-tie").textContent = winners.filter((w) => w === "tie").length;

  // Average score per criterion, drawn as horizontal bars.
  const bars = $("criteria-bars");
  bars.innerHTML = "";
  CRITERIA.forEach((c) => {
    const group = el("div", {}, [el("div", { className: "bar-group__label", text: c.label })]);
    ["A", "B"].forEach((side) => {
      const avg = average(done.map((t) => state.annotations[t.id].scores[side][c.id]));
      const fill = el("div", { className: `bar-fill bar-fill--${side.toLowerCase()}` });
      fill.style.width = Number.isNaN(avg) ? "0%" : `${(avg / 5) * 100}%`;
      const row = el("div", { className: "bar-row", "aria-label": `Response ${side}: ${Number.isNaN(avg) ? "no data" : avg.toFixed(2)}` }, [
        el("div", { className: "bar-track" }, [fill]),
        el("span", { className: "bar-value", text: Number.isNaN(avg) ? "—" : avg.toFixed(2) }),
      ]);
      group.append(row);
    });
    bars.append(group);
  });

  // Detail table.
  const table = $("results-table");
  table.innerHTML = "";
  const headers = ["#", "Category", "Avg. A", "Avg. B", "Preference", "Justification"];
  const head = table.createTHead().insertRow();
  headers.forEach((h) => head.append(el("th", { text: h })));

  const body = table.createTBody();
  state.tasks.forEach((task, i) => {
    const a = state.annotations[task.id];
    const row = body.insertRow();
    row.append(el("td", { className: "num", text: String(i + 1) }));
    row.append(el("td", { text: task.category || "General" }));
    if (a) {
      row.append(el("td", { className: "num", text: average(Object.values(a.scores.A)).toFixed(2) }));
      row.append(el("td", { className: "num", text: average(Object.values(a.scores.B)).toFixed(2) }));
      row.append(el("td", { text: PREFERENCES.find((p) => p.value === a.preference).label }));
      row.append(el("td", { className: "justification", text: a.justification }));
    } else {
      row.append(el("td", { className: "pending", text: "Pending", colspan: "4" }));
    }
  });
}

// ---------- Export ----------
function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = el("a", { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportCsv() {
  const header = ["task_id", "category", "prompt"];
  ["A", "B"].forEach((side) => CRITERIA.forEach((c) => header.push(`${side}_${c.id}`)));
  header.push("A_average", "B_average", "preference", "winner", "justification", "saved_at");

  const rows = state.tasks
    .filter((t) => state.annotations[t.id])
    .map((t) => {
      const a = state.annotations[t.id];
      const row = [t.id, t.category || "", t.prompt];
      ["A", "B"].forEach((side) => CRITERIA.forEach((c) => row.push(a.scores[side][c.id])));
      const pref = PREFERENCES.find((p) => p.value === a.preference);
      row.push(
        average(Object.values(a.scores.A)).toFixed(2),
        average(Object.values(a.scores.B)).toFixed(2),
        pref.label,
        pref.winner,
        a.justification,
        a.savedAt
      );
      return row;
    });

  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  // The BOM makes Excel open accents (é, ñ) correctly.
  download("annotations.csv", "﻿" + csv, "text/csv;charset=utf-8");
}

function exportJson() {
  const data = state.tasks
    .filter((t) => state.annotations[t.id])
    .map((t) => ({ task_id: t.id, category: t.category, prompt: t.prompt, ...state.annotations[t.id] }));
  download("annotations.json", JSON.stringify(data, null, 2), "application/json");
}

// ---------- Loading custom tasks ----------
function isValidTask(task) {
  return task && typeof task.id === "string" && typeof task.prompt === "string" &&
    typeof task.responseA === "string" && typeof task.responseB === "string";
}

function loadTasksFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const tasks = JSON.parse(reader.result);
      if (!Array.isArray(tasks) || !tasks.length || !tasks.every(isValidTask)) throw new Error();
      if (new Set(tasks.map((t) => t.id)).size !== tasks.length) throw new Error();
      state.tasks = tasks;
      state.annotations = {};
      $("error").hidden = true;
      goTo(0);
    } catch {
      $("error").textContent =
        "Invalid file. It must be a JSON array of tasks with unique \"id\" values and the fields \"prompt\", \"responseA\" and \"responseB\".";
      $("error").hidden = false;
    }
  };
  reader.readAsText(file);
}

function resetAll() {
  if (!confirm("Delete all annotations and start again with the sample tasks?")) return;
  state.tasks = SAMPLE_TASKS;
  state.annotations = {};
  goTo(0);
}

// ---------- Events ----------
$("next-btn").addEventListener("click", saveAndNext);
$("prev-btn").addEventListener("click", () => state.current > 0 && goTo(state.current - 1));
$("results-btn").addEventListener("click", showResults);
$("back-btn").addEventListener("click", () => goTo(state.current));
$("export-csv").addEventListener("click", exportCsv);
$("export-json").addEventListener("click", exportJson);
$("reset-btn").addEventListener("click", resetAll);
$("justification").addEventListener("input", updateCharCount);
$("file-input").addEventListener("change", (e) => {
  if (e.target.files[0]) loadTasksFile(e.target.files[0]);
  e.target.value = "";
});

// ---------- Start ----------
$("min-chars").textContent = MIN_JUSTIFICATION;
buildRubric("A");
buildRubric("B");
buildPreference();
loadProgress();
renderTask();
