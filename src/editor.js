import { AXES, cloneDefaultQuestions } from "./data/questions.js";
import { SWITCHES } from "./data/switches.js?v=20260806a";
import { normalizeSwitch } from "./scoring/normalizeSwitch.js";
import { loadQuestions, migrateQuestionConfig, saveQuestions, resetQuestions, validateQuestions } from "./configStore.js";

const dom = {
  editor: document.getElementById("questionEditor"),
  status: document.getElementById("editorStatus"),
  errors: document.getElementById("editorErrors"),
  save: document.getElementById("saveConfigBtn"),
  test: document.getElementById("testConfigBtn"),
  export: document.getElementById("exportConfigBtn"),
  import: document.getElementById("importConfigInput"),
  reset: document.getElementById("resetConfigBtn"),
  switchAuditSummary: document.getElementById("switchAuditSummary"),
  switchAuditRows: document.getElementById("switchAuditRows")
};
const loaded = loadQuestions();
let questions = loaded.questions;
let dirty = false;

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);

function render() {
  dom.editor.innerHTML = questions.map((question, questionIndex) => questionCard(question, questionIndex)).join("");
}

function renderSwitchAudit() {
  const physicalFields = [
    "switchType", "silent", "actuationForce", "bottomOutForce", "responseSpeed",
    "pressTendency", "tactileStrength", "noise", "temperature", "clarity"
  ];
  let switchesWithMissingData = 0;
  dom.switchAuditRows.innerHTML = SWITCHES.map((sw, index) => {
    const normalized = normalizeSwitch(sw);
    const missing = physicalFields.filter(field => sw[field] == null || sw[field] === "" || sw[field] === "미상");
    if (missing.length) switchesWithMissingData += 1;
    const notes = [
      ...missing.map(field => field + " 누락"),
      sw.tactileStrength === "미상" ? "촉각은 타입으로 보조 추정" : ""
    ].filter(Boolean).join(", ") || "없음";
    return "<tr><td>" + (index + 1) + "</td><td>" + escapeHtml(sw.fullName) + "</td><td>" +
      escapeHtml(sw.switchType) + "</td><td>" + escapeHtml(sw.silent) + "</td><td>" +
      Math.round(normalized.completeness * 100) + "%</td><td>" + escapeHtml(notes) + "</td></tr>";
  }).join("");
  dom.switchAuditSummary.textContent = SWITCHES.length + "개 · 결측 포함 " + switchesWithMissingData + "개";
}

function questionCard(question, questionIndex) {
  return '<article class="editor-card" data-question-card="' + questionIndex + '">' +
    '<div class="editor-card-head"><div class="order-buttons">' +
    '<button class="icon-button" type="button" data-move="up" data-q="' + questionIndex + '" aria-label="' +
    escapeHtml(question.id) + ' 위로 이동"' + (questionIndex === 0 ? " disabled" : "") + '>↑</button>' +
    '<button class="icon-button" type="button" data-move="down" data-q="' + questionIndex + '" aria-label="' +
    escapeHtml(question.id) + ' 아래로 이동"' + (questionIndex === questions.length - 1 ? " disabled" : "") + '>↓</button></div>' +
    '<div><p class="section-kicker">' + escapeHtml(question.id) + '</p><h2>' + escapeHtml(question.question) + '</h2></div>' +
    '<label class="exclude-item"><input type="checkbox" data-q="' + questionIndex + '" data-field="enabled"' +
    (question.enabled ? " checked" : "") + '> 질문 사용</label></div>' +
    '<div class="editor-question-grid">' +
    editField("영역", question.category, questionIndex, "category") +
    editField("질문 문구", question.question, questionIndex, "question", "wide") +
    '<label class="field"><span>범위</span><select data-q="' + questionIndex + '" data-field="scope">' +
    scopeOption("outer", "outer · 겉인상", question.scope) +
    scopeOption("common", "common · 공통", question.scope) +
    scopeOption("inner", "inner · 숨은 모습", question.scope) + '</select></label>' +
    '<label class="field"><span>질문 가중치</span><input type="number" min="0" step="0.1" value="' +
    question.weight + '" data-q="' + questionIndex + '" data-field="weight"></label></div>' +
    questionAxisWeightEditor(question, questionIndex) +
    question.answers.map((answer, answerIndex) => answerEditor(answer, questionIndex, answerIndex)).join("") +
    "</article>";
}

function questionAxisWeightEditor(question, questionIndex) {
  return '<details class="question-axis-weights"><summary>축별 기준 가중치</summary><p>1은 기준 문항, 0에 가까울수록 보조 문항입니다.</p><div class="axis-score-grid">' +
    AXES.map(axis => {
      const value = Number.isFinite(question.axisWeights?.[axis.id]) ? question.axisWeights[axis.id] : "";
      return '<label><span>' + escapeHtml(axis.label) + '</span><input type="number" min="0" step="0.01" value="' +
        value + '" placeholder="기본 1" data-q="' + questionIndex + '" data-question-axis="' + axis.id + '"></label>';
    }).join("") + "</div></details>";
}

function editField(label, value, questionIndex, field, className = "") {
  return '<label class="field ' + className + '"><span>' + escapeHtml(label) + '</span><input type="text" value="' +
    escapeHtml(value) + '" data-q="' + questionIndex + '" data-field="' + field + '"></label>';
}

function scopeOption(value, label, selected) {
  return '<option value="' + value + '"' + (value === selected ? " selected" : "") + ">" + label + "</option>";
}

function answerEditor(answer, questionIndex, answerIndex) {
  return '<section class="editor-answer"><div class="answer-edit-head"><span class="answer-letter">' +
    escapeHtml(answer.id) + '</span><label class="field"><span>답변 문구</span><input type="text" value="' +
    escapeHtml(answer.text) + '" data-q="' + questionIndex + '" data-a="' + answerIndex +
    '" data-answer-field="text"></label><label class="field answer-weight"><span>답변 가중치</span><input type="number" min="0" step="0.1" value="' +
    answer.weight + '" data-q="' + questionIndex + '" data-a="' + answerIndex +
    '" data-answer-field="weight"></label></div><div class="axis-score-grid">' +
    AXES.map(axis => {
      const value = Number.isFinite(answer.scores[axis.id]) ? answer.scores[axis.id] : "";
      return '<label><span>' + escapeHtml(axis.label) + '</span><input type="number" min="0" max="100" step="1" value="' +
        value + '" placeholder="제외" data-q="' + questionIndex + '" data-a="' + answerIndex +
        '" data-axis="' + axis.id + '"></label>';
    }).join("") + "</div></section>";
}

function updateFromInput(target) {
  const questionIndex = Number(target.dataset.q);
  if (!Number.isInteger(questionIndex) || !questions[questionIndex]) return;
  const question = questions[questionIndex];
  if (target.dataset.questionAxis) {
    question.axisWeights ||= {};
    if (target.value === "") delete question.axisWeights[target.dataset.questionAxis];
    else question.axisWeights[target.dataset.questionAxis] = Number(target.value);
  } else if (target.dataset.field) {
    const field = target.dataset.field;
    question[field] = field === "enabled" ? target.checked : field === "weight" ? Number(target.value) : target.value;
  } else if (target.dataset.answerField) {
    const answer = question.answers[Number(target.dataset.a)];
    answer[target.dataset.answerField] = target.dataset.answerField === "weight" ? Number(target.value) : target.value;
  } else if (target.dataset.axis) {
    const answer = question.answers[Number(target.dataset.a)];
    if (target.value === "") delete answer.scores[target.dataset.axis];
    else answer.scores[target.dataset.axis] = Number(target.value);
  }
  markDirty();
}

function markDirty() {
  dirty = true;
  dom.status.textContent = "저장하지 않은 변경사항이 있습니다.";
  dom.errors.textContent = "";
}

function showErrors(errors) {
  dom.errors.textContent = errors.join("\n");
}

function save() {
  const validation = saveQuestions(questions);
  if (!validation.valid) {
    showErrors(validation.errors);
    dom.status.textContent = "설정을 저장하지 못했습니다.";
    return false;
  }
  dirty = false;
  dom.errors.textContent = "";
  dom.status.textContent = "현재 설정을 브라우저 localStorage에 저장했습니다.";
  return true;
}

function moveQuestion(index, direction) {
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  if (nextIndex < 0 || nextIndex >= questions.length) return;
  [questions[index], questions[nextIndex]] = [questions[nextIndex], questions[index]];
  markDirty();
  render();
  document.querySelector('[data-question-card="' + nextIndex + '"]')?.scrollIntoView({ block: "center" });
}

function exportJson() {
  const validation = validateQuestions(questions);
  if (!validation.valid) {
    showErrors(validation.errors);
    return;
  }
  const blob = new Blob([JSON.stringify(questions, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "chukbti-questions.json";
  anchor.click();
  URL.revokeObjectURL(url);
  dom.status.textContent = "현재 설정 JSON을 내보냈습니다.";
}

async function importJson(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const migrated = migrateQuestionConfig(parsed);
    const validation = validateQuestions(migrated.questions);
    if (!validation.valid) {
      showErrors(validation.errors);
      dom.status.textContent = "JSON을 불러오지 못했습니다.";
      return;
    }
    questions = migrated.questions;
    dirty = true;
    dom.errors.textContent = "";
    dom.status.textContent = "JSON을 불러왔습니다. 브라우저에 저장해야 진단 화면에 반영됩니다.";
    render();
  } catch (error) {
    showErrors(["JSON 파싱 오류: " + error.message]);
    dom.status.textContent = "JSON을 불러오지 못했습니다.";
  } finally {
    dom.import.value = "";
  }
}

dom.editor.addEventListener("input", event => updateFromInput(event.target));
dom.editor.addEventListener("change", event => updateFromInput(event.target));
dom.editor.addEventListener("click", event => {
  const button = event.target.closest("[data-move]");
  if (button) moveQuestion(Number(button.dataset.q), button.dataset.move);
});
dom.save.addEventListener("click", save);
dom.test.addEventListener("click", () => {
  if (save()) location.href = "./index.html";
});
dom.export.addEventListener("click", exportJson);
dom.import.addEventListener("change", event => importJson(event.target.files[0]));
dom.reset.addEventListener("click", () => {
  if (!confirm("질문 설정을 기본값으로 되돌릴까요? 저장된 사용자 설정이 삭제됩니다.")) return;
  questions = resetQuestions();
  dirty = false;
  dom.errors.textContent = "";
  dom.status.textContent = "기본 질문 설정으로 초기화했습니다.";
  render();
});
window.addEventListener("beforeunload", event => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = "";
});

dom.status.textContent = loaded.source === "localStorage"
  ? "브라우저에 저장된 사용자 설정을 불러왔습니다."
  : "기본 질문 설정을 불러왔습니다.";
if (loaded.errors.length) showErrors(loaded.errors);
renderSwitchAudit();
render();
