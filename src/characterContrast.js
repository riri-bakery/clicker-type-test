import { AXES } from "./data/questions.js";

const AXIS_IDS = AXES.map(axis => axis.id);
const isNumber = value => Number.isFinite(value);
const clamp = value => Math.max(0, Math.min(1, value));

export function sharedProfileChanges(firstProfile = {}, secondProfile = {}) {
  const changes = AXIS_IDS
    .filter(axis => isNumber(firstProfile[axis]) && isNumber(secondProfile[axis]))
    .map(axis => ({ axis, delta: secondProfile[axis] - firstProfile[axis] }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  const magnitude = changes.length
    ? Math.sqrt(changes.reduce((sum, item) => sum + item.delta * item.delta, 0) / changes.length)
    : 0;
  return { changes, magnitude };
}

export function interpersonalStyle(profile) {
  if (!profile) return null;
  if (profile.warmth <= 35 && profile.tactile >= 70) return "guarded";
  if (profile.warmth >= 85 && profile.smoothness >= 85) return "warm";
  if (profile.warmth >= 60 && profile.quiet <= 55 && profile.tactile >= 30) return "playful";
  return "reserved-care";
}

export function innerRelationshipStyle(profile) {
  if (!profile) return null;
  if (profile.warmth <= 30 && profile.tactile >= 70) return "boundary";
  if (profile.warmth >= 75 && profile.smoothness >= 70) return "caring";
  if (profile.speed >= 75 && profile.presence >= 70) return "expressive";
  if (profile.weight <= 30 && profile.clarity <= 35) return "vulnerable";
  return "complex";
}

function relationshipContrast(publicStyle, innerStyle) {
  if (!publicStyle || !innerStyle) return null;
  if (innerStyle === "boundary") return publicStyle !== "guarded";
  if (innerStyle === "caring") return publicStyle === "guarded";
  if (innerStyle === "expressive") return publicStyle !== "playful";
  if (innerStyle === "vulnerable") return true;
  return null;
}

export function assessCharacterContrast({
  outerProfile = {}, interpersonalProfile = null, innerProfile = {}
} = {}) {
  const outerInner = sharedProfileChanges(outerProfile, innerProfile);
  const interpersonalInner = interpersonalProfile
    ? sharedProfileChanges(interpersonalProfile, innerProfile)
    : { changes: [], magnitude: 0 };
  const publicStyle = interpersonalStyle(interpersonalProfile);
  const innerStyle = innerRelationshipStyle(innerProfile);
  const relationshipResult = relationshipContrast(publicStyle, innerStyle);
  const isContrast = relationshipResult == null
    ? outerInner.magnitude >= 20
    : relationshipResult;
  const magnitude = Math.max(outerInner.magnitude, interpersonalInner.magnitude);
  // 20 미만은 반전 보너스를 주지 않고, 50 이상이면 최대 강도로 봅니다.
  const strength = isContrast ? clamp((magnitude - 20) / 30) : 0;
  return {
    isContrast,
    magnitude,
    strength,
    bonusEligible: isContrast && strength > 0,
    publicStyle,
    innerStyle,
    outerInner,
    interpersonalInner
  };
}
