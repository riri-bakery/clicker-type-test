import test from "node:test";
import assert from "node:assert/strict";
import { cloneDefaultQuestions } from "../src/data/questions.js";
import { QUESTION_COPY_MIGRATIONS } from "../src/data/questionCopyMigrations.js";
import { migrateQuestionConfig, validateQuestions } from "../src/configStore.js";
import { switchTypeLabel, brandSignature } from "../src/displayLabels.js";

test("saved default copy migrates without changing scores or custom copy", () => {
  const questions = cloneDefaultQuestions();
  for (const [id, [before]] of Object.entries(QUESTION_COPY_MIGRATIONS)) {
    const [qid, field] = id.split(".");
    const q = questions.find(item => item.id === qid);
    if (["question", "category"].includes(field)) q[field] = before;
    else q.answers.find(answer => answer.id === field).text = before;
  }
  questions[0].question = "직접 편집한 질문";
  questions[0].answers[0].scores.quiet = 91;
  const result = migrateQuestionConfig(questions);
  assert.equal(result.changed, true);
  assert.equal(result.questions[0].question, "직접 편집한 질문");
  assert.equal(result.questions[0].answers[0].scores.quiet, 91);
  assert.equal(result.questions[6].question, "이 캐릭터의 목소리 톤에 가까운 것은?");
  assert.ok(result.questions.every(q => q.category === ""));
  assert.equal(validateQuestions(result.questions).valid, true);
  assert.equal(migrateQuestionConfig(result.questions).changed, false);
});

test("display labels preserve stored switch types and omit deleted legacy name", () => {
  assert.equal(switchTypeLabel("클릭키"), "클릭");
  assert.equal(switchTypeLabel("택타일"), "택타일");
  assert.equal(brandSignature("", "꾹꾹이 쿠키 클리커"), "by 꾹꾹이 쿠키 클리커");
});
