import { AXES, cloneDefaultQuestions } from "./data/questions.js";
import { QUESTION_COPY_MIGRATIONS } from "./data/questionCopyMigrations.js";

export const STORAGE_KEYS = Object.freeze({
  questions: "chukbti.questions.v2",
  progress: "chukbti.progress.v2"
});

const AXIS_IDS = new Set(AXES.map(axis => axis.id));
const SCOPES = new Set(["outer", "inner", "common"]);
const REQUIRED_QUESTION_IDS = new Set(["Q12", "Q13"]);
const SCORE_MIGRATIONS = Object.freeze({
  "Q5.A.weight": [15, 8], "Q5.B.weight": [50, 40], "Q5.C.weight": [85, 55],
  "Q5.D.weight": [100, 75], "Q5.D.presence": [100, 88],
  "Q6.C.clarity": [40, 50], "Q6.D.clarity": [10, 30],
  "Q7.A.quiet": [100, 93], "Q7.A.clarity": [15, 30], "Q7.A.presence": [5, 15],
  "Q7.B.quiet": [70, 75], "Q7.B.clarity": [40, 50], "Q7.B.presence": [45, 30], "Q7.B.warmth": [70, 65],
  "Q7.C.quiet": [35, 49], "Q7.C.clarity": [90, 75], "Q7.C.presence": [75, 55],
  "Q7.D.quiet": [0, 11], "Q7.D.clarity": [100, 95], "Q7.D.presence": [100, 88],
  "Q9.A.warmth": [0, 10], "Q9.B.warmth": [30, 35], "Q9.C.warmth": [75, 65], "Q9.D.warmth": [100, 90],
  "Q10.A.presence": [10, 15], "Q10.B.presence": [45, 30], "Q10.B.weight": [80, 60],
  "Q10.C.presence": [75, 55], "Q10.C.weight": [60, 55], "Q10.C.clarity": [85, 75],
  "Q10.D.presence": [100, 88], "Q10.D.weight": [85, 65],
  "Q12.A.tactile": [5, 6], "Q12.B.tactile": [55, 30], "Q12.C.tactile": [82, 59],
  "Q12.C.smoothness": [40, 55], "Q12.D.tactile": [100, 80], "Q12.D.smoothness": [15, 35],
  "Q13.A.speed": [20, 30], "Q13.C.speed": [85, 75], "Q13.D.speed": [100, 95]
});

export function appendMissingRequiredQuestions(questions) {
  const merged = JSON.parse(JSON.stringify(questions));
  const existingIds = new Set(merged.map(question => question.id));
  const missing = cloneDefaultQuestions().filter(question =>
    REQUIRED_QUESTION_IDS.has(question.id) && !existingIds.has(question.id)
  );
  return { questions: [...merged, ...missing], addedIds: missing.map(question => question.id) };
}

export function migrateQuestionConfig(questions) {
  const required = appendMissingRequiredQuestions(questions);
  const migrated = required.questions;
  const defaults = new Map(cloneDefaultQuestions().map(question => [question.id, question]));
  let changed = required.addedIds.length > 0;
  let scoreUpdates = 0;
  migrated.forEach(question => {
    for (const field of ["category", "question"]) {
      const copy = QUESTION_COPY_MIGRATIONS[question.id + "." + field];
      if (copy && (question[field] === copy[0] || copy.slice(2).includes(question[field]))) {
        question[field] = copy[1];
        changed = true;
      }
    }
    const defaultQuestion = defaults.get(question.id);
    if (defaultQuestion?.axisWeights) {
      const current = question.axisWeights && typeof question.axisWeights === "object" ? question.axisWeights : {};
      const mergedWeights = { ...defaultQuestion.axisWeights, ...current };
      if (!question.axisWeights || Object.keys(defaultQuestion.axisWeights).some(axis => current[axis] == null)) changed = true;
      question.axisWeights = mergedWeights;
    }
    question.answers?.forEach(answer => {
      const copy = QUESTION_COPY_MIGRATIONS[question.id + "." + answer.id];
      if (copy && answer.text === copy[0]) {
        answer.text = copy[1];
        changed = true;
      }
      Object.keys(answer.scores || {}).forEach(axis => {
        const migration = SCORE_MIGRATIONS[question.id + "." + answer.id + "." + axis];
        if (migration && answer.scores[axis] === migration[0]) {
          answer.scores[axis] = migration[1];
          scoreUpdates += 1;
          changed = true;
        }
      });
    });
  });
  return { questions: migrated, addedIds: required.addedIds, scoreUpdates, changed };
}

export function validateQuestions(value) {
  const errors = [];
  if (!Array.isArray(value)) return { valid: false, errors: ["루트: 질문 설정은 배열이어야 합니다."] };
  const ids = new Set();
  value.forEach((question, questionIndex) => {
    const path = "질문[" + questionIndex + "]";
    if (!question || typeof question !== "object") {
      errors.push(path + ": 객체가 아닙니다.");
      return;
    }
    if (!question.id || typeof question.id !== "string") errors.push(path + ".id: 문자열 ID가 필요합니다.");
    else if (ids.has(question.id)) errors.push(path + ".id: 중복 ID '" + question.id + "'입니다.");
    else ids.add(question.id);
    if (typeof question.question !== "string" || !question.question.trim()) errors.push(path + ".question: 질문 문구가 필요합니다.");
    if (typeof question.category !== "string") errors.push(path + ".category: 문자열이어야 합니다.");
    if (typeof question.enabled !== "boolean") errors.push(path + ".enabled: true 또는 false여야 합니다.");
    if (!SCOPES.has(question.scope)) errors.push(path + ".scope: outer, inner, common 중 하나여야 합니다.");
    if (!Number.isFinite(question.weight) || question.weight < 0) errors.push(path + ".weight: 0 이상의 숫자여야 합니다.");
    if (question.axisWeights != null) {
      if (typeof question.axisWeights !== "object" || Array.isArray(question.axisWeights)) {
        errors.push(path + ".axisWeights: 축별 가중치 객체여야 합니다.");
      } else {
        Object.entries(question.axisWeights).forEach(([axis, weight]) => {
          if (!AXIS_IDS.has(axis)) errors.push(path + ".axisWeights." + axis + ": 알 수 없는 분석축입니다.");
          if (!Number.isFinite(weight) || weight < 0) errors.push(path + ".axisWeights." + axis + ": 0 이상의 숫자여야 합니다.");
        });
      }
    }
    if (!Array.isArray(question.answers) || question.answers.length !== 4) {
      errors.push(path + ".answers: 답변 A~D 4개가 필요합니다.");
      return;
    }
    const answerIds = new Set();
    question.answers.forEach((answer, answerIndex) => {
      const answerPath = path + ".answers[" + answerIndex + "]";
      if (!answer?.id || typeof answer.id !== "string") errors.push(answerPath + ".id: 문자열 ID가 필요합니다.");
      else if (answerIds.has(answer.id)) errors.push(answerPath + ".id: 중복 답변 ID입니다.");
      else answerIds.add(answer.id);
      if (typeof answer?.text !== "string" || !answer.text.trim()) errors.push(answerPath + ".text: 답변 문구가 필요합니다.");
      if (!Number.isFinite(answer?.weight) || answer.weight < 0) errors.push(answerPath + ".weight: 0 이상의 숫자여야 합니다.");
      if (!answer?.scores || typeof answer.scores !== "object" || Array.isArray(answer.scores)) {
        errors.push(answerPath + ".scores: 점수 객체가 필요합니다.");
        return;
      }
      Object.entries(answer.scores).forEach(([axis, score]) => {
        if (!AXIS_IDS.has(axis)) errors.push(answerPath + ".scores." + axis + ": 알 수 없는 분석축입니다.");
        if (!Number.isFinite(score) || score < 0 || score > 100) errors.push(answerPath + ".scores." + axis + ": 0~100 숫자여야 합니다.");
      });
    });
  });
  return { valid: errors.length === 0, errors };
}

export function loadQuestions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.questions);
    if (!raw) return { questions: cloneDefaultQuestions(), source: "default", errors: [] };
    const parsed = JSON.parse(raw);
    const validation = validateQuestions(parsed);
    if (!validation.valid) return { questions: cloneDefaultQuestions(), source: "default", errors: validation.errors };
    const migrated = migrateQuestionConfig(parsed);
    if (migrated.changed) {
      localStorage.setItem(STORAGE_KEYS.questions, JSON.stringify(migrated.questions));
    }
    return {
      questions: migrated.questions,
      source: "localStorage",
      errors: [],
      migratedQuestionIds: migrated.addedIds
    };
  } catch (error) {
    return { questions: cloneDefaultQuestions(), source: "default", errors: ["저장된 설정 파싱 오류: " + error.message] };
  }
}

export function saveQuestions(questions) {
  const validation = validateQuestions(questions);
  if (!validation.valid) return validation;
  localStorage.setItem(STORAGE_KEYS.questions, JSON.stringify(questions));
  return validation;
}

export function resetQuestions() {
  localStorage.removeItem(STORAGE_KEYS.questions);
  return cloneDefaultQuestions();
}

export function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.progress) || "{}");
  } catch {
    return {};
  }
}

export function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(progress));
}

export function clearProgress() {
  localStorage.removeItem(STORAGE_KEYS.progress);
}
