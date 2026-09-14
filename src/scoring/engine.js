import { AXES } from "../data/questions.js";
import { normalizeSwitches } from "./normalizeSwitch.js";
import { assessCharacterContrast } from "../characterContrast.js";

const AXIS_IDS = AXES.map(axis => axis.id);
const AXIS_LABELS = Object.fromEntries(AXES.map(axis => [axis.id, axis.label]));
const NEUTRAL = 50;
const clamp = value => Math.max(0, Math.min(100, value));
const isNumber = value => Number.isFinite(value);

function emptyAccumulator() {
  return Object.fromEntries(AXIS_IDS.map(axis => [axis, { total: 0, weight: 0 }]));
}

export function buildCharacterProfile(questions, selections, scope = null) {
  const accumulator = emptyAccumulator();
  const contributions = [];
  questions
    .filter(question => question.enabled && (scope == null || question.scope === scope))
    .forEach(question => {
      const answerId = selections[question.id];
      const answer = question.answers.find(item => item.id === answerId);
      if (!answer) return;
      const baseWeight = question.weight * answer.weight;
      const axisContributions = {};
      Object.entries(answer.scores).forEach(([axis, score]) => {
        if (!AXIS_IDS.includes(axis) || !isNumber(score)) return;
        const axisWeight = question.axisWeights?.[axis] ?? 1;
        const contributionWeight = baseWeight * axisWeight;
        accumulator[axis].total += score * contributionWeight;
        accumulator[axis].weight += contributionWeight;
        axisContributions[axis] = { score, weight: contributionWeight };
      });
      contributions.push({
        questionId: question.id, question: question.question, answerId: answer.id,
        answer: answer.text, scope: question.scope, contributions: axisContributions
      });
    });
  const profile = {};
  AXIS_IDS.forEach(axis => {
    profile[axis] = accumulator[axis].weight
      ? accumulator[axis].total / accumulator[axis].weight
      : null;
  });
  return { profile, contributions };
}

function sparseProfileSimilarity(characterProfile, switchProfile) {
  const axes = AXIS_IDS.filter(axis => isNumber(characterProfile?.[axis]) && isNumber(switchProfile?.[axis]));
  const perAxis = Object.fromEntries(axes.map(axis => [axis, clamp(100 - Math.abs(characterProfile[axis] - switchProfile[axis]))]));
  const score = axes.length
    ? axes.reduce((sum, axis) => sum + perAxis[axis], 0) / axes.length
    : NEUTRAL;
  return { score, axes, perAxis };
}

export function contrastSimilarity(characterOuter, characterInner, switchOuter, switchInner, assessment = null) {
  const outer = sparseProfileSimilarity(characterOuter, switchOuter);
  const inner = sparseProfileSimilarity(characterInner, switchInner);
  const validScores = [outer, inner].filter(item => item.axes.length).map(item => item.score);
  const score = validScores.length
    ? validScores.reduce((sum, value) => sum + value, 0) / validScores.length
    : NEUTRAL;
  const neutral = !assessment?.bonusEligible;
  return {
    score,
    neutral,
    reason: neutral
      ? "강한 대비가 없어 기본 키감만 반영함"
      : "첫인상은 소리 특성에, 숨은 면은 실제 눌림 특성에 각각 비교함",
    outer,
    inner
  };
}

export function physicalSimilarity(characterProfile, switchProfile) {
  const perAxis = {};
  const usedAxes = [];
  const excludedAxes = [];
  let total = 0;
  AXIS_IDS.forEach(axis => {
    const character = characterProfile[axis];
    const sw = switchProfile[axis];
    if (!isNumber(character) || !isNumber(sw)) {
      perAxis[axis] = null;
      excludedAxes.push(axis);
      return;
    }
    const similarity = clamp(100 - Math.abs(character - sw));
    perAxis[axis] = similarity;
    usedAxes.push(axis);
    total += similarity;
  });
  return {
    score: usedAxes.length ? total / usedAxes.length : NEUTRAL,
    perAxis, usedAxes, excludedAxes
  };
}

export function analyze({ questions, selections, switches, filters = {} }) {
  const overall = buildCharacterProfile(questions, selections);
  const outer = buildCharacterProfile(questions, selections, "outer");
  const inner = buildCharacterProfile(questions, selections, "inner");
  const common = buildCharacterProfile(questions, selections, "common");
  const interpersonalQuestion = questions.find(question => question.enabled && question.id === "Q4");
  const interpersonal = interpersonalQuestion
    ? buildCharacterProfile([interpersonalQuestion], selections)
    : { profile: null, contributions: [] };
  const contrastAssessment = assessCharacterContrast({
    outerProfile: outer.profile,
    interpersonalProfile: interpersonal.profile,
    innerProfile: inner.profile
  });
  const normalized = normalizeSwitches(switches);
  const candidates = normalized.filter(sw => {
    if (Array.isArray(filters.switchTypes) && !filters.switchTypes.includes(sw.switchType)) return false;
    if (Array.isArray(filters.silentValues) && !filters.silentValues.includes(sw.silent)) return false;
    if (filters.switchType && sw.switchType !== filters.switchType) return false;
    if (filters.silent && sw.silent !== filters.silent) return false;
    if (filters.excludedNames?.includes(sw.fullName)) return false;
    return true;
  });
  const rankings = candidates.map(sw => {
    const physical = physicalSimilarity(overall.profile, sw.profile);
    const contrast = contrastSimilarity(
      outer.profile, inner.profile, sw.outerProfile, sw.innerProfile, contrastAssessment
    );
    const baseScore = physical.score * 0.8;
    const contrastBonus = contrastAssessment.bonusEligible
      ? contrast.score * contrastAssessment.strength * 0.2
      : 0;
    const finalScore = baseScore + contrastBonus;
    return {
      switch: sw, physical, contrast, baseScore, contrastBonus, finalScore,
      topAxes: Object.entries(physical.perAxis)
        .filter(([, value]) => isNumber(value))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([axis, score]) => ({ axis, label: AXIS_LABELS[axis], score }))
    };
  }).sort((a, b) =>
    b.finalScore - a.finalScore ||
    b.switch.completeness - a.switch.completeness ||
    b.physical.score - a.physical.score ||
    a.switch.fullName.localeCompare(b.switch.fullName, "ko")
  );
  return {
    character: {
      overallProfile: overall.profile, outerProfile: outer.profile,
      innerProfile: inner.profile, commonProfile: common.profile,
      interpersonalProfile: interpersonal.profile, contrastAssessment,
      contributions: overall.contributions
    },
    rankings
  };
}

export function axisPhrase(axis, value) {
  const high = value >= 67;
  const low = value <= 33;
  const phrases = {
    quiet: high ? "조용한 소리" : low ? "큰 소리" : "절제된 소리",
    weight: high ? "묵직한 바닥 무게" : low ? "가벼운 눌림" : "균형 잡힌 무게",
    speed: high ? "빠르고 즉각적인 반응" : low ? "느리고 안정적인 반응" : "고른 반응 속도",
    tactile: high ? "분명한 걸림" : low ? "걸림이 적은 눌림" : "적당한 촉각 구분감",
    warmth: high ? "따뜻한 인상" : low ? "차가운 인상" : "중립적인 온도",
    clarity: high ? "또렷한 선명도" : low ? "먹먹하고 흐린 소리" : "부드러운 선명도",
    smoothness: high ? "매끄럽고 부드러운 눌림" : low ? "까칠하고 거친 질감" : "적당히 단단한 질감",
    presence: high ? "강한 존재감" : low ? "옅은 존재감" : "절제된 존재감"
  };
  return phrases[axis];
}

export function explainRecommendation(result) {
  const physicalReasons = result.topAxes
    .map(item => axisPhrase(item.axis, result.switch.profile[item.axis]))
    .join(", ");
  const contrastText = result.contrast.neutral
    ? "겉과 속의 대비가 크지 않아 기본 키감 일치도를 중심으로 선정했습니다."
    : result.contrast.score >= 65
      ? "겉으로 드러나는 인상과 실제 눌림의 변화 방향도 캐릭터의 겉과 속의 차이와 비슷합니다."
      : "기본 키감은 잘 맞지만 겉과 속의 변화 방향은 일부 다릅니다.";
  return physicalReasons + "이 캐릭터의 핵심 성향과 잘 맞습니다. " + contrastText;
}

export function compareAlternative(primary, alternative) {
  const differences = AXIS_IDS
    .filter(axis => isNumber(primary.switch.profile[axis]) && isNumber(alternative.switch.profile[axis]))
    .map(axis => ({ axis, delta: alternative.switch.profile[axis] - primary.switch.profile[axis] }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const main = differences[0];
  if (!main) return "1위와 비교할 수 있는 데이터가 부족합니다.";
  const direction = main.delta >= 0 ? "더 높은" : "더 낮은";
  return "1위보다 " + AXIS_LABELS[main.axis] + "이 " + direction + " 대안입니다.";
}

export { AXIS_IDS, AXIS_LABELS };
