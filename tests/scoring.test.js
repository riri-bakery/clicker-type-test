import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DEFAULT_QUESTIONS, cloneDefaultQuestions } from "../src/data/questions.js";
import { SWITCHES } from "../src/data/switches.js";
import { analyze, buildCharacterProfile } from "../src/scoring/engine.js";
import { normalizeSwitch } from "../src/scoring/normalizeSwitch.js";
import { appendMissingRequiredQuestions, migrateQuestionConfig, validateQuestions } from "../src/configStore.js";

function selections(overrides = {}, fallback = "B") {
  return Object.fromEntries(DEFAULT_QUESTIONS.map(question => [
    question.id,
    overrides[question.id] || fallback
  ]));
}

function run(selected, switches = SWITCHES, questions = DEFAULT_QUESTIONS) {
  return analyze({ questions, selections: selected, switches, filters: {} });
}

test("1. 조용하고 부드러운 방향의 응답을 결정론적으로 계산한다", () => {
  const selected = selections({
    Q1: "A", Q2: "A", Q3: "A", Q4: "B", Q5: "B", Q6: "D",
    Q7: "A", Q8: "B", Q9: "D", Q10: "A", Q11: "A"
  });
  const first = run(selected);
  const second = run(selected);
  assert.equal(first.rankings.length, 37);
  assert.deepEqual(
    first.rankings.slice(0, 5).map(item => item.switch.fullName),
    second.rankings.slice(0, 5).map(item => item.switch.fullName)
  );
  assert.ok(first.character.overallProfile.quiet > 70);
  assert.ok(first.character.overallProfile.smoothness > 75);
});

test("2. 강하고 외향적인 방향의 응답을 계산한다", () => {
  const selected = selections({
    Q1: "D", Q2: "D", Q3: "D", Q4: "D", Q5: "D", Q6: "A",
    Q7: "D", Q8: "D", Q9: "A", Q10: "D", Q11: "C"
  });
  const result = run(selected);
  assert.ok(result.character.overallProfile.presence > 80);
  assert.ok(result.character.overallProfile.clarity > 85);
  assert.ok(result.rankings[0].finalScore > 50);
});

test("3. 겉은 조용하지만 오래 보면 냉정하고 단호한 변화가 보존된다", () => {
  const result = run(selections({ Q1: "A", Q11: "B" }));
  const changes = Object.fromEntries(result.character.contrastAssessment.outerInner.changes.map(item => [item.axis, item.delta]));
  assert.ok(result.character.outerProfile.quiet > result.character.innerProfile.quiet);
  assert.ok(result.character.innerProfile.tactile > 80);
  assert.ok(changes.quiet < 0);
  assert.ok(changes.clarity > 0);
});

test("4. 겉은 강렬하지만 오래 보면 여린 변화가 반대 방향으로 보존된다", () => {
  const result = run(selections({ Q1: "D", Q11: "D" }));
  const changes = Object.fromEntries(result.character.contrastAssessment.outerInner.changes.map(item => [item.axis, item.delta]));
  assert.ok(changes.quiet > 0);
  assert.ok(changes.presence < 0);
});

test("5. Q1과 Q11이 비슷해도 두 프로필을 별도로 유지한다", () => {
  const result = run(selections({ Q1: "A", Q11: "D" }));
  assert.notDeepEqual(result.character.outerProfile, result.character.innerProfile);
  assert.ok(Number.isFinite(result.rankings[0].contrast.score));
});

test("6. 작동압이 없어도 바닥압으로 무게를 재정규화한다", () => {
  const source = SWITCHES.find(sw => sw.actuationForce == null && Number.isFinite(sw.bottomOutForce));
  assert.ok(source);
  const normalized = normalizeSwitch(source);
  assert.ok(Number.isFinite(normalized.profile.weight));
  assert.ok(normalized.completeness < 1);
});

test("7. 바닥압이 없어도 작동압으로 무게를 재정규화한다", () => {
  const source = SWITCHES.find(sw => sw.bottomOutForce == null && Number.isFinite(sw.actuationForce));
  assert.ok(source);
  const normalized = normalizeSwitch(source);
  assert.ok(Number.isFinite(normalized.profile.weight));
  assert.ok(normalized.completeness < 1);
});

test("8. 촉각 강도가 미상이면 스위치 타입을 보조값으로 쓴다", () => {
  const source = SWITCHES.find(sw => sw.tactileStrength === "미상");
  assert.ok(source);
  const normalized = normalizeSwitch(source);
  assert.ok(Number.isFinite(normalized.profile.tactile));
});

test("9. 비활성 질문은 진행 프로필과 기여에서 제외된다", () => {
  const questions = cloneDefaultQuestions();
  questions.find(question => question.id === "Q9").enabled = false;
  const selected = selections();
  const profile = buildCharacterProfile(questions, selected);
  assert.equal(profile.contributions.some(item => item.questionId === "Q9"), false);
  assert.equal(profile.contributions.length, 12);
});

test("10. 편집기에서 변경한 문구와 점수 설정을 검증한다", () => {
  const questions = cloneDefaultQuestions();
  questions[0].question = "편집한 첫 질문";
  questions[0].answers[0].scores.quiet = 88;
  const validation = validateQuestions(questions);
  assert.equal(validation.valid, true);
  assert.equal(validation.errors.length, 0);
  questions[0].axisWeights.quiet = -1;
  assert.equal(validateQuestions(questions).valid, false);
});

test("11. 동일 점수에서는 원본 물리 데이터 완성도가 높은 스위치를 우선한다", () => {
  const template = {
    ...SWITCHES[0],
    fullName: "Z 완전 데이터",
    productName: "완전 데이터",
    actuationForce: 50,
    bottomOutForce: 50
  };
  const incomplete = {
    ...template,
    fullName: "A 결측 데이터",
    productName: "결측 데이터",
    actuationForce: null
  };
  const result = run(selections(), [incomplete, template]);
  assert.equal(result.rankings[0].switch.fullName, "Z 완전 데이터");
  assert.equal(result.rankings[0].finalScore, result.rankings[1].finalScore);
});

test("12. 모바일 레이아웃용 미디어 쿼리가 존재한다", async () => {
  const css = await readFile(new URL("../styles.css", import.meta.url), "utf8");
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(css, /\.layout \{ grid-template-columns: 1fr;/);
});

test("반전이 없으면 기본 키감 순서를 유지하고 반전 보너스는 0점이다", () => {
  const result = run(selections({ Q4: "D", Q11: "B" }));
  assert.equal(result.character.contrastAssessment.isContrast, false);
  result.rankings.forEach(item => {
    assert.equal(item.contrastBonus, 0);
    assert.ok(Math.abs(item.finalScore - item.physical.score * 0.8) < 1e-10);
  });
  assert.deepEqual(
    result.rankings.map(item => item.switch.fullName),
    [...result.rankings].sort((a, b) => b.physical.score - a.physical.score ||
      b.switch.completeness - a.switch.completeness ||
      a.switch.fullName.localeCompare(b.switch.fullName, "ko")).map(item => item.switch.fullName)
  );
});

test("강한 반전일 때만 기본 80점 위에 최대 20점 보너스를 더한다", () => {
  const result = run(selections({ Q1: "B", Q4: "B", Q11: "B" }));
  assert.equal(result.character.contrastAssessment.bonusEligible, true);
  assert.ok(result.character.contrastAssessment.strength > 0);
  assert.ok(result.rankings.some(item => item.contrastBonus > 0));
  result.rankings.forEach(item => {
    assert.ok(item.contrastBonus >= 0 && item.contrastBonus <= 20);
    assert.ok(Math.abs(item.finalScore - item.baseScore - item.contrastBonus) < 1e-10);
  });
});

test("공개 재추천 필터는 복수 타입과 소음 조건 안에서만 결정론적으로 다시 정렬한다", () => {
  const selected = selections();
  const first = analyze({
    questions: DEFAULT_QUESTIONS,
    selections: selected,
    switches: SWITCHES,
    filters: { switchTypes: ["택타일"], silentValues: ["예"] }
  });
  const second = analyze({
    questions: DEFAULT_QUESTIONS,
    selections: selected,
    switches: SWITCHES,
    filters: { switchTypes: ["택타일"], silentValues: ["예"] }
  });
  assert.equal(first.rankings.length, 7);
  assert.ok(first.rankings.every(item => item.switch.switchType === "택타일" && item.switch.silent === "예"));
  assert.deepEqual(first.rankings.map(item => item.switch.fullName), second.rankings.map(item => item.switch.fullName));
});

test("존재하지 않는 클릭키 저소음 조합은 빈 후보를 반환한다", () => {
  const result = analyze({
    questions: DEFAULT_QUESTIONS,
    selections: selections(),
    switches: SWITCHES,
    filters: { switchTypes: ["클릭키"], silentValues: ["예"] }
  });
  assert.equal(result.rankings.length, 0);
});

test("원문 키압과 구조화 키압을 일치시키고 가을축을 클릭 타입으로 분류한다", () => {
  const expected = {
    "Wingtree 골든애플 축": [45, 53],
    "FL CMMK 아이스그린 축": [40, 55],
    "Kailh BOX 가을 축": [60, null],
    "하이무 위스퍼 저소음 택타일 스위치": [47, 60],
    "Haimu 저소음 바다소금축": [47, 55],
    "하이무 저소음 핑크솔트 축": [45, 50]
  };
  Object.entries(expected).forEach(([name, forces]) => {
    const sw = SWITCHES.find(item => item.fullName === name);
    assert.ok(sw, name);
    assert.deepEqual([sw.actuationForce, sw.bottomOutForce], forces);
  });
  assert.equal(SWITCHES.find(item => item.fullName === "Kailh BOX 가을 축").switchType, "클릭키");
});

test("Q12와 Q13은 촉각·매끄러움과 반응 형태를 독립적으로 보강한다", () => {
  const q12 = DEFAULT_QUESTIONS.find(question => question.id === "Q12");
  const q13 = DEFAULT_QUESTIONS.find(question => question.id === "Q13");
  assert.equal(DEFAULT_QUESTIONS.length, 13);
  assert.deepEqual(q12.answers.map(answer => answer.scores), [
    { tactile: 6, smoothness: 90 },
    { tactile: 30, smoothness: 75 },
    { tactile: 59, smoothness: 55 },
    { tactile: 80, smoothness: 35 }
  ]);
  assert.deepEqual(q13.answers.map(answer => answer.scores), [
    { speed: 30, weight: 65 },
    { speed: 50, smoothness: 90 },
    { speed: 75, weight: 25 },
    { speed: 95, clarity: 95 }
  ]);
});

test("기존 11문항 사용자 설정에는 Q12와 Q13을 보존적으로 추가한다", () => {
  const oldQuestions = cloneDefaultQuestions().filter(question => !["Q12", "Q13"].includes(question.id));
  oldQuestions[0].question = "사용자가 편집한 질문";
  const migrated = appendMissingRequiredQuestions(oldQuestions);
  assert.deepEqual(migrated.addedIds, ["Q12", "Q13"]);
  assert.equal(migrated.questions.length, 13);
  assert.equal(migrated.questions[0].question, "사용자가 편집한 질문");
});

test("이전 기본 점수는 보정하되 사용자가 바꾼 점수는 보존한다", () => {
  const oldQuestions = cloneDefaultQuestions();
  oldQuestions.forEach(question => { delete question.axisWeights; });
  oldQuestions.find(question => question.id === "Q5").answers[0].scores.weight = 15;
  oldQuestions.find(question => question.id === "Q5").answers[1].scores.weight = 44;
  const migrated = migrateQuestionConfig(oldQuestions);
  const q5 = migrated.questions.find(question => question.id === "Q5");
  assert.equal(q5.answers[0].scores.weight, 8);
  assert.equal(q5.answers[1].scores.weight, 44);
  assert.equal(q5.axisWeights.weight, 1);
  assert.equal(migrated.changed, true);
});

test("축별 가중치는 같은 질문 안에서도 분석축별 영향력을 다르게 적용한다", () => {
  const questions = [
    {
      id: "T1", category: "테스트", enabled: true, scope: "common", weight: 1,
      axisWeights: { quiet: 1, warmth: 0.1 },
      question: "기준 문항",
      answers: [{ id: "A", text: "기준", scores: { quiet: 100, warmth: 100 }, weight: 1 }]
    },
    {
      id: "T2", category: "테스트", enabled: true, scope: "common", weight: 1,
      axisWeights: { quiet: 0.1, warmth: 1 },
      question: "보조 문항",
      answers: [{ id: "A", text: "보조", scores: { quiet: 0, warmth: 0 }, weight: 1 }]
    }
  ];
  const result = buildCharacterProfile(questions, { T1: "A", T2: "A" });
  assert.ok(result.profile.quiet > 90);
  assert.ok(result.profile.warmth < 10);
});
