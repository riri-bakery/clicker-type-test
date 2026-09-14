import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DEFAULT_QUESTIONS } from "../src/data/questions.js";
import { brandConfig } from "../src/publicConfig.js";
import {
  alternativeLabel, buildProductLinks, createResultSnapshot, describeOuterInner, getClickType, resultNameLine
} from "../src/resultPresentation.js";
import {
  buildShareUrl, decodeResultPayload, decodeResultState, encodeResultPayload, shareMode
} from "../src/share.js";
import { groupSwitchesForCatalog } from "../src/switchCatalogModel.js";
import { SWITCHES } from "../src/data/switches.js";

const completeSelections = Object.fromEntries(DEFAULT_QUESTIONS.map(question => [question.id, "B"]));
const profile = overrides => ({
  quiet: 50, weight: 50, speed: 50, tactile: 50,
  warmth: 50, clarity: 50, smoothness: 50, presence: 50,
  ...overrides
});

test("공개 결과 유형명은 같은 프로필에서 결정론적이다", () => {
  const input = profile({ quiet: 82, tactile: 74, weight: 67 });
  const first = getClickType(input, profile(), input);
  const second = getClickType(input, profile(), input);
  assert.deepEqual(first, second);
  assert.equal(first.title, "고요한 단단함");
});

test("규칙에 걸리지 않는 프로필은 강한 두 특성으로 fallback 유형을 만든다", () => {
  const type = getClickType(profile({ clarity: 61, speed: 39 }), profile(), profile());
  assert.equal(type.fallback, true);
  assert.match(type.id, /^fallback-/);
  assert.ok(type.title.length >= 4);
});

test("fallback 유형 ID는 같은 축이라도 높고 낮은 방향을 구분한다", () => {
  const high = getClickType(profile({ clarity: 63, speed: 39 }), profile(), profile());
  const low = getClickType(profile({ clarity: 37, speed: 61 }), profile(), profile());
  assert.equal(high.fallback, true);
  assert.equal(low.fallback, true);
  assert.notEqual(high.id, low.id);
  assert.notEqual(high.title, low.title);
});

test("겉과 속 변화가 작으면 억지로 반전이라 설명하지 않는다", () => {
  const description = describeOuterInner({
    outerText: "차분하다", innerText: "차분하다",
    outerProfile: profile({ quiet: 70 }), innerProfile: profile({ quiet: 75 }),
    overallProfile: profile({ quiet: 74 })
  });
  assert.equal(description.isContrast, false);
  assert.match(description.text, /크게 달라지지 않습니다/);
});

test("겉과 속 변화가 크면 두 인상을 연결해 설명한다", () => {
  const description = describeOuterInner({
    outerText: "조용하다", innerText: "단호하다",
    outerProfile: profile({ quiet: 95, tactile: 10 }),
    innerProfile: profile({ quiet: 30, tactile: 95 }),
    overallProfile: profile()
  });
  assert.equal(description.isContrast, true);
  assert.match(description.text, /가까워진 뒤/);
});

test("조용한 겉인상과 냉정한 속내를 실제 변화축으로 자연스럽게 설명한다", () => {
  const description = describeOuterInner({
    outerProfile: { quiet: 80, clarity: 50, presence: 45 },
    interpersonalProfile: {
      quiet: 65, warmth: 95, smoothness: 95, tactile: 15
    },
    innerProfile: {
      quiet: 65, weight: 75, speed: 55, tactile: 90,
      warmth: 10, clarity: 85, smoothness: 25, presence: 65
    },
    overallProfile: profile({ quiet: 72, clarity: 68, tactile: 70 })
  });
  assert.equal(description.text,
    "처음에는 조용하면서도 자연스럽게 시선을 끄는 인상입니다. " +
    "평소에는 다른 사람을 편안하고 다정하게 받아주지만, 자신의 기준이나 경계가 침범되는 순간에는 냉정하고 단호하게 선을 긋습니다. " +
    "부드러운 대인 태도와 분명한 자기 기준을 함께 가진 캐릭터입니다."
  );
  assert.equal(description.isContrast, true);
});

test("원래부터 선이 분명한 대인 태도라면 냉정함을 뒤늦은 반전으로 만들지 않는다", () => {
  const description = describeOuterInner({
    outerProfile: { quiet: 80, clarity: 50, presence: 45 },
    interpersonalProfile: {
      quiet: 55, warmth: 15, smoothness: 20, tactile: 85
    },
    innerProfile: {
      quiet: 65, weight: 75, speed: 55, tactile: 90,
      warmth: 10, clarity: 85, smoothness: 25, presence: 65
    },
    overallProfile: profile({ quiet: 72, clarity: 68, tactile: 70 })
  });
  assert.equal(description.isContrast, false);
  assert.match(description.text, /다른 사람을 대할 때부터 경계와 기준이 분명/);
  assert.match(description.text, /일관되게 나타납니다/);
});

test("추가 추천 라벨은 1위와 실제 차이가 가장 큰 축으로 정한다", () => {
  const primary = { switch: { profile: profile({ smoothness: 42, weight: 55 }) } };
  const alternative = { switch: { profile: profile({ smoothness: 85, weight: 58 }) } };
  assert.equal(alternativeLabel(primary, alternative), "더 부드러운 선택");
});

test("결과 스냅샷은 향후 비교 기능에 재사용 가능한 형식을 유지한다", () => {
  const clickType = { id: "quiet-firm", title: "고요한 단단함", description: "설명" };
  const snapshot = createResultSnapshot({
    characterName: "긴 이름을 가진 캐릭터",
    selections: completeSelections,
    analysis: {
      character: { overallProfile: profile() },
      rankings: [{ switch: { fullName: "테스트 축" }, finalScore: 87 }]
    },
    clickType
  });
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.answers.Q11, "B");
  assert.equal(snapshot.recommendations[0].score, 87);
});

test("공유 결과 데이터는 13개 답변을 복원하고 잘못된 값은 거부한다", () => {
  const encoded = encodeResultPayload(completeSelections);
  assert.deepEqual(decodeResultPayload(encoded, DEFAULT_QUESTIONS), completeSelections);
  const invalid = encodeResultPayload({ ...completeSelections, Q13: "Z" });
  assert.equal(decodeResultPayload(invalid, DEFAULT_QUESTIONS), null);
  assert.equal(decodeResultPayload("not-valid", DEFAULT_QUESTIONS), null);
});

test("필터 재추천 결과는 공유 링크에서 같은 후보 조건으로 복원된다", () => {
  const publicFilters = { switchTypes: ["택타일"], silentValues: ["예"] };
  const encoded = encodeResultPayload(completeSelections, publicFilters);
  const restored = decodeResultState(encoded, DEFAULT_QUESTIONS);
  assert.deepEqual(restored.selections, completeSelections);
  assert.deepEqual(restored.publicFilters, publicFilters);
  const url = buildShareUrl({ href: "https://example.com/index.html" }, completeSelections, publicFilters);
  assert.deepEqual(
    decodeResultState(new URL(url).searchParams.get("result"), DEFAULT_QUESTIONS).publicFilters,
    publicFilters
  );
});

test("기존 v1 공유 링크는 전체 타입·소음 조건으로 안전하게 복원된다", () => {
  const legacy = Buffer.from(JSON.stringify({ v: 1, a: completeSelections })).toString("base64url");
  const restored = decodeResultState(legacy, DEFAULT_QUESTIONS);
  assert.deepEqual(restored.publicFilters, {
    switchTypes: ["클릭키", "택타일", "리니어"],
    silentValues: ["아니오", "예"]
  });
});

test("기존 11문항 공유 링크는 Q12와 Q13을 B로 보완해 계속 연다", () => {
  const legacySelections = Object.fromEntries(
    DEFAULT_QUESTIONS.filter(question => Number(question.id.slice(1)) <= 11).map(question => [question.id, "B"])
  );
  const restored = decodeResultPayload(encodeResultPayload(legacySelections), DEFAULT_QUESTIONS);
  assert.equal(restored.Q12, "B");
  assert.equal(restored.Q13, "B");
  assert.equal(Object.keys(restored).length, 13);
});

test("공유 링크에는 캐릭터 이름을 넣지 않고 답변만 직렬화한다", () => {
  const fakeLocation = { href: "https://example.com/index.html?old=1#top" };
  const url = buildShareUrl(fakeLocation, completeSelections);
  assert.equal(url.includes("긴 이름을 가진 캐릭터"), false);
  assert.equal(new URL(url).searchParams.has("result"), true);
  assert.equal(new URL(url).hash, "");
});

test("URL 미설정 상태는 임의 주소 없이 유지된다", () => {
  assert.equal(brandConfig.urls.productUrl, "");
  assert.equal(brandConfig.urls.applicationUrl, "");
  assert.equal(brandConfig.share.kakaoJavascriptKey, "");
  assert.deepEqual(buildProductLinks(brandConfig.urls), []);
  assert.equal(buildProductLinks({ productUrl: "https://example.com/product" }).length, 1);
});

test("이름 입력 여부와 Web Share 지원 여부에 따라 공개 문구를 안전하게 바꾼다", () => {
  assert.equal(resultNameLine(""), "이 캐릭터의 클릭 타입은");
  assert.equal(resultNameLine("아주 긴 이름의 캐릭터"), "아주 긴 이름의 캐릭터의 클릭 타입은");
  assert.equal(shareMode({ share() {} }), "web-share");
  assert.equal(shareMode({}), "copy-link");
});

test("공개 HTML은 관리자 편집기 링크를 직접 노출하지 않는다", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.doesNotMatch(html, /href="\.\/editor\.html"/);
  assert.match(html, /id="adminTools"[^>]+hidden/);
  assert.match(html, /캐릭터 분석 시작하기/);
  assert.match(html, /13문항/);
  assert.match(html, /리리 베이커리가 보유한/);
  assert.match(html, /id="refineForm"/);
  assert.match(html, /보유 스위치 모두 보기/);
});

test("보유 스위치 목록은 타입별로 묶이고 각 타입 안에서 작동압순이다", () => {
  const groups = groupSwitchesForCatalog(SWITCHES);
  assert.deepEqual(groups.map(group => group.type), ["리니어", "택타일", "클릭키"]);
  assert.deepEqual(groups.map(group => group.switches.length), [21, 9, 7]);
  groups.forEach(group => {
    const forces = group.switches.map(sw => Number.isFinite(sw.actuationForce) ? sw.actuationForce : Infinity);
    assert.deepEqual(forces, [...forces].sort((a, b) => a - b));
  });
});

test("보유 스위치 페이지는 37개 범위와 주관적 해석 안내를 제공한다", async () => {
  const html = await readFile(new URL("../switches.html", import.meta.url), "utf8");
  assert.match(html, /현재 보유한 <strong id="catalogCount">37개<\/strong>/);
  assert.match(html, /주관적인 판단/);
  assert.match(html, /id="catalogGroups"/);
});

test("공개 CSS는 모바일 터치 크기와 애니메이션 감소 설정을 포함한다", async () => {
  const css = await readFile(new URL("../public.css", import.meta.url), "utf8");
  assert.match(css, /@media \(max-width: 600px\)/);
  assert.match(css, /min-height: 64px/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});

test("공유 PNG는 1080×1920 상세 카드 구성요소를 포함한다", async () => {
  const share = await readFile(new URL("../src/share.js", import.meta.url), "utf8");
  assert.match(share, /canvas\.width = 1080/);
  assert.match(share, /canvas\.height = 1920/);
  assert.match(share, /캐릭터 해석/);
  assert.match(share, /어울리는 클릭감/);
  assert.match(share, /가장 어울리는 스위치/);
  assert.match(share, /다른 방향도 어울려요/);
});

test("정적 SNS 메타데이터는 공개 설정과 동기화된다", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(html, new RegExp(brandConfig.meta.ogTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(html, new RegExp(brandConfig.meta.pageDescription.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
