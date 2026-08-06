import { DEFAULT_QUESTIONS } from "../src/data/questions.js";
import { SWITCHES } from "../src/data/switches.js";
import { analyze } from "../src/scoring/engine.js";

const requestedSamples = Number(process.argv[2] || 10000);
const sampleCount = Number.isInteger(requestedSamples) && requestedSamples > 0
  ? Math.min(requestedSamples, 1000000)
  : 10000;
let seed = 987654321;
const nextAnswerIndex = () => {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed >>> 30;
};
const counts = new Map(SWITCHES.map(sw => [sw.fullName, 0]));

for (let index = 0; index < sampleCount; index += 1) {
  const selections = Object.fromEntries(DEFAULT_QUESTIONS.map(question => [
    question.id,
    question.answers[nextAnswerIndex()].id
  ]));
  const top = analyze({
    questions: DEFAULT_QUESTIONS,
    selections,
    switches: SWITCHES,
    filters: {}
  }).rankings[0];
  counts.set(top.switch.fullName, counts.get(top.switch.fullName) + 1);
}

const rows = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"));
const appeared = rows.filter(([, count]) => count > 0);
const never = rows.filter(([, count]) => count === 0);
const percentage = count => (count / sampleCount * 100).toFixed(3) + "%";

console.log(`결정론적 균등 응답 표본 ${sampleCount.toLocaleString("ko-KR")}개`);
console.log(`1위 등장: ${appeared.length}/${SWITCHES.length}개`);
console.log("\n분포");
rows.forEach(([name, count]) => console.log(`${String(count).padStart(7)}  ${percentage(count).padStart(8)}  ${name}`));
if (never.length) {
  console.log("\n표본에서 1위 미등장");
  never.forEach(([name]) => console.log("- " + name));
}
console.log(`\n주의: 표본 감사는 전체 4^${DEFAULT_QUESTIONS.length} 조합에 대한 수학적 도달 가능성 증명이 아닙니다.`);
