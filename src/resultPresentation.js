import { AXES } from "./data/questions.js";
import { resultTypeRules } from "./publicConfig.js";
import { assessCharacterContrast, sharedProfileChanges } from "./characterContrast.js";

const AXIS_IDS = AXES.map(axis => axis.id);
const isNumber = value => Number.isFinite(value);

export function contrastMagnitude(outerProfile, innerProfile) {
  return sharedProfileChanges(outerProfile, innerProfile).magnitude;
}

function matchesRule(rule, context) {
  return Object.entries(rule.all).every(([key, bounds]) => {
    const value = context[key];
    if (!isNumber(value)) return false;
    if (isNumber(bounds.min) && value < bounds.min) return false;
    if (isNumber(bounds.max) && value > bounds.max) return false;
    return true;
  });
}

const FALLBACK_WORDS = {
  quiet: { high: "고요한", low: "생생한", nounHigh: "여운", nounLow: "울림" },
  weight: { high: "묵직한", low: "가벼운", nounHigh: "중심", nounLow: "발걸음" },
  speed: { high: "빠른", low: "느긋한", nounHigh: "직진", nounLow: "호흡" },
  tactile: { high: "단단한", low: "매끄러운", nounHigh: "기준", nounLow: "결" },
  warmth: { high: "따뜻한", low: "서늘한", nounHigh: "온기", nounLow: "정밀함" },
  clarity: { high: "선명한", low: "포근한", nounHigh: "윤곽", nounLow: "여백" },
  smoothness: { high: "부드러운", low: "까칠한", nounHigh: "다정함", nounLow: "경계" },
  presence: { high: "강렬한", low: "잔잔한", nounHigh: "존재감", nounLow: "관찰자" }
};

function strongestTraits(profile) {
  return AXIS_IDS
    .filter(axis => isNumber(profile?.[axis]))
    .map(axis => ({ axis, value: profile[axis], distance: Math.abs(profile[axis] - 50) }))
    .sort((a, b) => b.distance - a.distance || AXIS_IDS.indexOf(a.axis) - AXIS_IDS.indexOf(b.axis));
}

export function getClickType(profile, outerProfile = {}, innerProfile = {}) {
  const context = { ...profile, contrastMagnitude: contrastMagnitude(outerProfile, innerProfile) };
  const matched = resultTypeRules.find(rule => matchesRule(rule, context));
  if (matched) return { ...matched, fallback: false };
  const traits = strongestTraits(profile);
  const first = traits[0] || { axis: "quiet", value: 50 };
  const second = traits.find(item => item.axis !== first.axis) || first;
  const firstWords = FALLBACK_WORDS[first.axis];
  const secondWords = FALLBACK_WORDS[second.axis];
  const firstSide = first.value >= 50 ? "high" : "low";
  const secondSide = second.value >= 50 ? "High" : "Low";
  const title = firstWords[firstSide] + " " + secondWords["noun" + secondSide];
  return {
    id: "fallback-" + first.axis + "-" + firstSide + "-" + second.axis + "-" + secondSide.toLowerCase(),
    title,
    description: "가장 선명하게 드러난 두 가지 감각을 함께 담은 캐릭터 타입",
    fallback: true
  };
}

const CHARACTER_SENTENCES = {
  quiet: { high: "감정을 크게 소리 내기보다 조용한 방식으로 존재감을 남깁니다.", low: "감정과 존재감이 생생하게 바깥으로 드러납니다." },
  weight: { high: "쉽게 흔들리지 않는 무게와 자기 기준을 지니고 있습니다.", low: "가볍고 유연하게 상황의 흐름을 바꾸는 편입니다." },
  speed: { high: "판단과 반응이 빨라 마음의 방향을 오래 숨기지 않습니다.", low: "서두르기보다 충분히 살핀 뒤 안정적으로 움직입니다." },
  tactile: { high: "부드러워 보여도 가까이 다가가면 분명한 선과 기준이 느껴집니다.", low: "사람과 상황을 큰 마찰 없이 부드럽게 받아들이는 편입니다." },
  warmth: { high: "관계 안에서는 따뜻하고 다정한 온기가 오래 남습니다.", low: "감정보다 판단이 먼저 보이는 서늘한 인상을 줍니다." },
  clarity: { high: "말과 행동의 윤곽이 또렷해 의도를 알아보기 쉽습니다.", low: "한 번에 읽히지 않는 여백과 은근한 분위기를 품고 있습니다." },
  smoothness: { high: "말과 행동에는 매끄럽고 편안한 결이 있습니다.", low: "쉽게 다가가기 어려운 까칠한 결이 매력으로 남습니다." },
  presence: { high: "등장만으로 주변의 분위기와 이야기의 흐름을 움직입니다.", low: "앞에 나서지 않아도 조용히 자기 자리를 지킵니다." }
};

export function describeCharacter(profile) {
  const traits = strongestTraits(profile).slice(0, 3);
  if (!traits.length) return "답변이 쌓이면 캐릭터의 소리와 손끝 감각을 해석할 수 있어요.";
  return traits.map(({ axis, value }) => CHARACTER_SENTENCES[axis][value >= 50 ? "high" : "low"]).join(" ");
}

function level(value, ranges) {
  if (!isNumber(value)) return "정보가 적음";
  return ranges.find(item => value >= item.min)?.label || ranges[ranges.length - 1].label;
}

export function describeFeel(profile) {
  return [
    { id: "quiet", label: "소리", value: level(profile.quiet, [
      { min: 78, label: "매우 조용함" }, { min: 62, label: "조용한 편" },
      { min: 42, label: "차분한 편" }, { min: 22, label: "또렷한 편" }, { min: -Infinity, label: "크게 들리는 편" }
    ]) },
    { id: "weight", label: "무게", value: level(profile.weight, [
      { min: 78, label: "묵직함" }, { min: 60, label: "조금 묵직함" },
      { min: 40, label: "중간" }, { min: 22, label: "가벼운 편" }, { min: -Infinity, label: "매우 가벼움" }
    ]) },
    { id: "speed", label: "반응", value: level(profile.speed, [
      { min: 78, label: "매우 빠름" }, { min: 60, label: "빠른 편" },
      { min: 40, label: "고른 편" }, { min: 22, label: "느긋한 편" }, { min: -Infinity, label: "천천히 반응" }
    ]) },
    { id: "tactile", label: "걸림", value: level(profile.tactile, [
      { min: 78, label: "매우 분명함" }, { min: 60, label: "분명한 편" },
      { min: 40, label: "적당함" }, { min: 22, label: "은은함" }, { min: -Infinity, label: "거의 없음" }
    ]) },
    { id: "warmth", label: "온도", value: level(profile.warmth, [
      { min: 75, label: "따뜻함" }, { min: 58, label: "따뜻한 편" },
      { min: 42, label: "중간" }, { min: 25, label: "서늘한 편" }, { min: -Infinity, label: "차가움" }
    ]) },
    { id: "clarity", label: "선명도", value: level(profile.clarity, [
      { min: 78, label: "매우 또렷함" }, { min: 60, label: "선명한 편" },
      { min: 40, label: "차분한 편" }, { min: 22, label: "부드럽게 흐림" }, { min: -Infinity, label: "먹먹하고 흐림" }
    ]) },
    { id: "smoothness", label: "눌림", value: level(profile.smoothness, [
      { min: 75, label: "매우 부드러움" }, { min: 58, label: "매끄러운 편" },
      { min: 42, label: "단정한 편" }, { min: 25, label: "조금 까칠함" }, { min: -Infinity, label: "거친 편" }
    ]) },
    { id: "presence", label: "존재감", value: level(profile.presence, [
      { min: 78, label: "매우 강함" }, { min: 60, label: "강한 편" },
      { min: 40, label: "은근한 편" }, { min: 22, label: "잔잔함" }, { min: -Infinity, label: "매우 옅음" }
    ]) }
  ];
}

function outerImpression(profile) {
  if (profile.quiet >= 85 && profile.presence <= 25) return "처음에는 존재감을 크게 드러내지 않는 조용한 인상입니다.";
  if (profile.quiet >= 70 && profile.presence >= 35) return "처음에는 조용하면서도 자연스럽게 시선을 끄는 인상입니다.";
  if (profile.presence >= 85 && profile.quiet <= 20) return "처음부터 감정과 존재감이 크고 또렷하게 드러납니다.";
  if (profile.presence >= 70) return "처음부터 주변 분위기를 바꾸는 선명한 존재감이 느껴집니다.";
  if (profile.quiet >= 65) return "처음에는 차분하고 절제된 인상으로 다가옵니다.";
  return "처음에는 생생하고 알아보기 쉬운 인상으로 다가옵니다.";
}

function innerImpression(profile) {
  if (profile.warmth <= 30 && profile.tactile >= 70) return "가까워진 뒤에는 선을 분명히 긋는 냉정한 면이 드러납니다.";
  if (profile.warmth >= 75 && profile.smoothness >= 70) return "가까워진 뒤에는 주변을 세심하게 챙기는 따뜻하고 다정한 면이 드러납니다.";
  if (profile.speed >= 75 && profile.presence >= 70) return "가까워진 뒤에는 장난스럽고 감정 표현이 풍부한 면이 드러납니다.";
  if (profile.weight <= 30 && profile.clarity <= 35) return "가까워진 뒤에는 쉽게 마음이 흔들리는 여린 면이 보입니다.";
  const core = strongestTraits(profile)[0];
  return core
    ? "가까워진 뒤에는 " + CHARACTER_SENTENCES[core.axis][core.value >= 50 ? "high" : "low"].replace(/^(감정을|쉽게|판단과|부드러워|관계 안에서는|감정보다|말과 행동의|한 번에|말과 행동에는|쉽게|등장만으로|앞에 나서지 않아도)/, "자기만의")
    : "가까워진 뒤에는 자기만의 기준과 감정이 조금 더 분명하게 보입니다.";
}

function contrastBridge(changes) {
  const main = changes[0];
  if (!main) return "첫인상과 가까워진 뒤의 모습이 서로 다른 깊이를 보여줍니다.";
  if (main.axis === "clarity" && main.delta > 0) return "겉의 절제된 분위기 안에 또렷한 기준을 품고 있는 캐릭터입니다.";
  if (main.axis === "clarity") return "처음의 또렷한 윤곽 안에 쉽게 읽히지 않는 여린 마음을 품고 있습니다.";
  if (main.axis === "presence" && main.delta > 0) return "잔잔한 첫인상 안에 예상보다 강한 존재감을 품고 있습니다.";
  if (main.axis === "presence") return "강하게 보이는 첫인상 뒤에 조용히 물러나는 섬세한 면이 있습니다.";
  if (main.axis === "quiet" && main.delta > 0) return "가까워질수록 말보다 마음의 깊이가 먼저 느껴지는 캐릭터입니다.";
  return "차분한 첫인상 안에 감정과 기준을 선명하게 드러내는 면을 품고 있습니다.";
}

function relationshipNarrative(assessment) {
  const publicStyle = assessment.publicStyle;
  const innerStyle = assessment.innerStyle;
  if (!publicStyle) return null;

  if (innerStyle === "boundary") {
    if (publicStyle === "guarded") {
      return {
        text: "다른 사람을 대할 때부터 경계와 기준이 분명한 편입니다. 가까워진 뒤에도 그 기준은 쉽게 흐려지지 않으며, 감정보다 원칙을 우선하는 태도가 일관되게 나타납니다."
      };
    }
    if (publicStyle === "warm") {
      return {
        text: "평소에는 다른 사람을 편안하고 다정하게 받아주지만, 자신의 기준이나 경계가 침범되는 순간에는 냉정하고 단호하게 선을 긋습니다. 부드러운 대인 태도와 분명한 자기 기준을 함께 가진 캐릭터입니다."
      };
    }
    if (publicStyle === "playful") {
      return {
        text: "평소에는 가까운 사람에게 장난스럽고 친근하게 다가가지만, 중요한 경계를 넘는 순간에는 태도가 분명하게 달라집니다. 편안함과 단호함을 상황에 따라 구분할 줄 아는 캐릭터입니다."
      };
    }
    return {
      text: "말은 적어도 다른 사람에게 필요한 것을 묵묵히 챙기는 편입니다. 다만 배려와 별개로 자신의 선은 분명하며, 중요한 기준이 침범되면 냉정하고 단호하게 대응합니다."
    };
  }

  if (innerStyle === "caring") {
    if (publicStyle === "guarded") {
      return {
        text: "다른 사람을 대할 때는 쉽게 거리를 좁히지 않고 경계를 분명히 둡니다. 하지만 신뢰가 쌓인 관계에서는 주변을 세심하게 챙기는 따뜻하고 다정한 면이 드러납니다."
      };
    }
    return {
      text: "다른 사람을 배려하고 편안하게 받아주는 태도가 관계가 깊어진 뒤에도 이어집니다. 처음의 다정한 인상과 실제 마음의 방향이 자연스럽게 연결되는 캐릭터입니다."
    };
  }

  if (innerStyle === "expressive") {
    if (publicStyle === "playful") {
      return {
        text: "가까운 사람에게 장난스럽게 다가가는 태도와 풍부한 감정 표현이 자연스럽게 이어집니다. 친밀한 관계에서 더 생생한 존재감을 보여주는 캐릭터입니다."
      };
    }
    return {
      text: "평소에는 감정을 절제해 다른 사람을 대하지만, 신뢰하는 관계에서는 장난스럽고 표현이 풍부한 면이 드러납니다. 관계의 깊이에 따라 온도가 달라지는 캐릭터입니다."
    };
  }

  if (innerStyle === "vulnerable") {
    if (publicStyle === "guarded") {
      return {
        text: "다른 사람에게는 까칠하고 경계가 분명한 태도를 보이지만, 그 단단한 선 안에는 쉽게 마음이 흔들리는 여린 면이 있습니다. 강한 태도가 자신을 지키는 방식에 가까운 캐릭터입니다."
      };
    }
    return {
      text: "다른 사람을 편안하게 받아주고 관계를 부드럽게 이어가지만, 혼자 감당해야 하는 마음에는 여리고 쉽게 흔들리는 면이 있습니다. 다정함과 취약함이 함께 놓인 캐릭터입니다."
    };
  }
  return null;
}

export function describeOuterInner({
  outerProfile, innerProfile, interpersonalProfile = null, overallProfile, contrastAssessment = null
}) {
  const shared = sharedProfileChanges(outerProfile, innerProfile);
  const assessment = contrastAssessment || assessCharacterContrast({ outerProfile, interpersonalProfile, innerProfile });
  const first = outerImpression(outerProfile);
  const relationship = relationshipNarrative(assessment);
  if (relationship) {
    return {
      isContrast: assessment.isContrast,
      magnitude: assessment.magnitude,
      text: first + " " + relationship.text
    };
  }
  const inner = innerImpression(innerProfile);
  if (!assessment.isContrast) {
    const core = strongestTraits(overallProfile)[0];
    const coreText = core ? CHARACTER_SENTENCES[core.axis][core.value >= 50 ? "high" : "low"] : "자기만의 중심을 꾸준히 지킵니다.";
    return {
      isContrast: false,
      magnitude: assessment.magnitude,
      text: first + " 가까워진 뒤에도 이 분위기는 크게 달라지지 않습니다. " + coreText
    };
  }
  return {
    isContrast: true,
    magnitude: assessment.magnitude,
    text: first + " " + inner + " " + contrastBridge(shared.changes)
  };
}

export function describeSwitchContrast(result, characterContrast) {
  const sw = result.switch;
  if (!characterContrast.isContrast || result.contrast.neutral) {
    return "처음 느껴지는 인상과 실제 성격의 결이 자연스럽게 이어지듯, 이 스위치도 소리와 눌림이 한 방향으로 편안하게 연결됩니다.";
  }
  const sound = sw.profile.quiet >= 65 ? "겉으로 들리는 소리는 조용하지만" : "첫 소리는 또렷하게 존재감을 드러내지만";
  const hasTactileBump = sw.switchType === "택타일" || sw.switchType === "클릭키" ||
    (sw.tactileStrength && !["없음", "미상"].includes(sw.tactileStrength));
  const touch = hasTactileBump
    ? "눌러보면 " + (sw.tactileStrength === "강함" ? "분명한" : "은근한") + " 걸림이 느껴집니다"
    : sw.profile.weight >= 65 ? "끝까지 누르면 묵직한 무게가 남습니다" : "실제로 누르면 부드러운 결이 드러납니다";
  const match = result.contrast.score >= 65
    ? "캐릭터의 겉과 속이 달라지는 방향을 함께 표현하기 좋습니다."
    : "기본적인 분위기는 잘 맞고, 겉과 속의 차이는 조금 더 은은하게 표현됩니다.";
  return sound + ", " + touch + ". " + match;
}

const ALTERNATIVE_LABELS = {
  quiet: { high: "더 조용한 선택", low: "더 생생한 소리" },
  weight: { high: "더 묵직한 선택", low: "더 가벼운 선택" },
  speed: { high: "더 빠른 선택", low: "더 느긋한 선택" },
  tactile: { high: "걸림이 더 분명한 선택", low: "더 매끄러운 선택" },
  warmth: { high: "더 따뜻한 선택", low: "더 서늘한 선택" },
  clarity: { high: "더 선명한 선택", low: "더 차분한 선택" },
  smoothness: { high: "더 부드러운 선택", low: "더 단단한 선택" },
  presence: { high: "존재감이 더 큰 선택", low: "더 잔잔한 선택" }
};

export function alternativeLabel(primary, alternative) {
  const differences = AXIS_IDS
    .filter(axis => isNumber(primary.switch.profile[axis]) && isNumber(alternative.switch.profile[axis]))
    .map(axis => ({ axis, delta: alternative.switch.profile[axis] - primary.switch.profile[axis] }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const main = differences.find(item => Math.abs(item.delta) >= 5) || differences[0];
  if (!main) return "결이 비슷한 또 다른 선택";
  return ALTERNATIVE_LABELS[main.axis][main.delta >= 0 ? "high" : "low"];
}

export function resultDecoration(profile) {
  if (profile.weight >= 72) return "heavy";
  if (profile.clarity >= 72 && profile.speed >= 65) return "crystal";
  if (profile.warmth <= 32) return "cold";
  if (profile.warmth >= 68) return "warm";
  if (profile.quiet <= 35) return "bright";
  return "cream";
}

export function resultNameLine(characterName) {
  const name = typeof characterName === "string" ? characterName.trim() : "";
  return name ? name + "의 클릭 타입은" : "이 캐릭터의 클릭 타입은";
}

export function buildProductLinks(urls = {}) {
  return [
    [urls.productUrl, "꾹꾹이 쿠키 클리커 구경하기", "product_view_click", "product"],
    [urls.processUrl, "제작 방식 알아보기", "product_view_click", "process"],
    [urls.scheduleUrl, "현재 신청 일정 확인하기", "application_click", "schedule"],
    [urls.applicationUrl, "이 결과로 신청하기", "application_click", "application"]
  ].filter(([url]) => typeof url === "string" && url.trim());
}

export function createResultSnapshot({ characterName, selections, analysis, clickType }) {
  return {
    version: 1,
    characterName: characterName || "",
    answers: { ...selections },
    clickType: { id: clickType.id, title: clickType.title, description: clickType.description },
    profile: { ...analysis.character.overallProfile },
    recommendations: analysis.rankings.slice(0, 3).map(item => ({
      switchName: item.switch.fullName,
      score: Math.round(item.finalScore)
    }))
  };
}
