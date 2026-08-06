export const SWITCH_TYPE_ORDER = Object.freeze(["리니어", "택타일", "클릭키"]);

export function sortSwitchesByForce(switches) {
  return [...switches].sort((a, b) => {
    const aForce = Number.isFinite(a.actuationForce) ? a.actuationForce : Number.POSITIVE_INFINITY;
    const bForce = Number.isFinite(b.actuationForce) ? b.actuationForce : Number.POSITIVE_INFINITY;
    return aForce - bForce ||
      (Number.isFinite(a.bottomOutForce) ? a.bottomOutForce : Number.POSITIVE_INFINITY) -
        (Number.isFinite(b.bottomOutForce) ? b.bottomOutForce : Number.POSITIVE_INFINITY) ||
      a.fullName.localeCompare(b.fullName, "ko");
  });
}

export function groupSwitchesForCatalog(switches) {
  return SWITCH_TYPE_ORDER.map(type => ({
    type,
    switches: sortSwitchesByForce(switches.filter(sw => sw.switchType === type))
  }));
}
