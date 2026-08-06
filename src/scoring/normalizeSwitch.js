import { AXES } from "../data/questions.js";

const UNKNOWN = new Set(["", "미상", "알 수 없음", "확인 불가"]);

export const NORMALIZATION_MAPS = Object.freeze({
  responseSpeed: { "매우 느림": 10, "느림": 30, "보통": 50, "빠름": 75, "매우 빠름": 95 },
  tactileStrength: { "없음": 5, "약함": 30, "중간": 60, "강함": 80, "매우 강함": 95 },
  switchTypeTactileFallback: { "리니어": 10, "택타일": 55, "클릭키": 65 },
  noiseQuietness: { "매우 조용함": 95, "보통": 55, "밝은 편": 35, "매우 큼": 5 },
  temperature: { "차가움": 10, "중립": 50, "따뜻함": 90 },
  clarity: { "매우 흐림": 10, "흐림": 30, "선명": 75, "매우 선명": 95 },
  pressTendency: {
    "가볍고 깨끗한 클릭": 60, "가볍고 또렷한 클릭": 55, "가볍고 톡톡 걸림": 50,
    "가볍고 통통 튀는 클릭": 55, "거슬림 없이 선명하고 안정됨": 75, "깊고 부드러운 눌림": 85,
    "날카롭고 즉각적인 클릭": 35, "날카롭고 탄성 있음": 45, "단단하고 탄성 있음": 55,
    "도톰하고 단단한 걸림": 35, "둥글고 단단한 걸림": 45, "둥글고 쫀득한 걸림": 55,
    "말랑하고 둥근 걸림": 70, "말랑하고 둥근 눌림": 85, "말랑하고 부드러움": 90,
    "매끄럽고 가벼움": 95, "매끄럽고 균형 잡힘": 90, "매끄럽고 단단하게 정돈됨": 80,
    "매끄럽고 밀도 높음": 85, "매끄럽고 부드러운 반발": 90, "매끄럽고 산뜻함": 90,
    "매끄럽고 유순함": 95, "매끄럽고 통통 튐": 85, "몽글하고 부드러움": 90,
    "무겁고 두꺼운 클릭": 30, "묵직하고 안정적임": 60, "보송하고 둥근 걸림": 65,
    "부드럽고 농밀함": 85, "얕고 매끄러움": 90, "잔잔하고 유순함": 85,
    "잔잔하고 차분한 걸림": 65, "쫀득하고 강한 클릭": 35, "쫀득하고 풍성함": 60,
    "차갑고 매끄러움": 90, "크리미하고 도톰함": 80, "폭신하고 끈기 있는 걸림": 60,
    "폭신하고 크리미함": 90
  }
});

const clamp = value => Math.max(0, Math.min(100, value));

function mapped(map, value) {
  const key = value == null ? "" : String(value).trim();
  if (UNKNOWN.has(key) || !(key in map)) return null;
  return map[key];
}

function weightedMean(items) {
  const valid = items.filter(item => Number.isFinite(item.value) && item.weight > 0);
  if (!valid.length) return null;
  const totalWeight = valid.reduce((sum, item) => sum + item.weight, 0);
  return valid.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
}

// 30g 이하를 매우 가볍게, 80g 이상을 매우 묵직하게 보고 그 사이를 선형 변환합니다.
export function normalizeForce(force) {
  if (!Number.isFinite(force)) return null;
  return clamp(((force - 30) / 50) * 100);
}

export function normalizeSwitch(source) {
  const actuation = normalizeForce(source.actuationForce);
  const bottomOut = normalizeForce(source.bottomOutForce);
  // 클리커는 끝까지 누르는 사용이 많으므로 바닥압 60%, 작동압 40%를 적용합니다.
  const weight = weightedMean([
    { value: actuation, weight: 0.4 },
    { value: bottomOut, weight: 0.6 }
  ]);

  const noiseQuietness = mapped(NORMALIZATION_MAPS.noiseQuietness, source.noise);
  const silentHint = source.silent === "예" ? 88 : source.silent === "아니오" ? 30 : null;
  const quiet = weightedMean([
    { value: noiseQuietness, weight: 0.75 },
    { value: silentHint, weight: 0.25 }
  ]);

  const tactileRaw = mapped(NORMALIZATION_MAPS.tactileStrength, source.tactileStrength);
  const tactileFallback = mapped(NORMALIZATION_MAPS.switchTypeTactileFallback, source.switchType);
  // 촉각 강도 열이 있으면 이를 우선하고, 타입은 보조 신호로만 사용합니다.
  const tactile = tactileRaw == null
    ? tactileFallback
    : weightedMean([{ value: tactileRaw, weight: 0.85 }, { value: tactileFallback, weight: 0.15 }]);

  const speed = mapped(NORMALIZATION_MAPS.responseSpeed, source.responseSpeed);
  const warmth = mapped(NORMALIZATION_MAPS.temperature, source.temperature);
  const clarity = mapped(NORMALIZATION_MAPS.clarity, source.clarity);
  const smoothness = mapped(NORMALIZATION_MAPS.pressTendency, source.pressTendency);
  // 존재감은 제품명이나 캐릭터 태그가 아니라 소리·선명도·촉각의 물리 신호로만 계산합니다.
  const presence = weightedMean([
    { value: quiet == null ? null : 100 - quiet, weight: 0.5 },
    { value: clarity, weight: 0.25 },
    { value: tactile, weight: 0.25 }
  ]);

  const profile = { quiet, weight, speed, tactile, warmth, clarity, smoothness, presence };
  const missingAxes = AXES.map(axis => axis.id).filter(axis => profile[axis] == null);
  const physicalFields = [
    source.switchType, source.silent, source.actuationForce, source.bottomOutForce,
    source.responseSpeed, source.pressTendency, source.tactileStrength,
    source.noise, source.temperature, source.clarity
  ];
  const completeness = physicalFields.filter(value =>
    value !== null && value !== undefined && !UNKNOWN.has(String(value).trim())
  ).length / physicalFields.length;

  // 겉 프로필은 소리로 바로 드러나는 특성, 안쪽 프로필은 눌러야 알 수 있는 특성만 담습니다.
  const outerProfile = {
    quiet, warmth, clarity,
    presence: weightedMean([
      { value: quiet == null ? null : 100 - quiet, weight: 0.65 },
      { value: clarity, weight: 0.35 }
    ])
  };
  const innerProfile = {
    weight, speed, tactile, smoothness,
    presence: weightedMean([
      { value: weight, weight: 0.3 },
      { value: speed, weight: 0.2 },
      { value: tactile, weight: 0.3 },
      { value: smoothness == null ? null : 100 - smoothness, weight: 0.2 }
    ])
  };

  return { ...source, profile, outerProfile, innerProfile, missingAxes, completeness };
}

export function normalizeSwitches(switches) {
  return switches.map(normalizeSwitch);
}
