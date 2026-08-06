const SAFE_FIELDS = new Set([
  "questionIndex", "totalQuestions", "resultTypeId", "shareMethod", "destination", "hasProductUrl"
]);

// 분석 도구가 없을 때는 아무 일도 하지 않습니다.
// 연결 시 window.chukbtiTrack 또는 chukbti:track 이벤트를 사용하면 됩니다.
export function trackEvent(name, payload = {}) {
  const safePayload = Object.fromEntries(
    Object.entries(payload).filter(([key, value]) => SAFE_FIELDS.has(key) &&
      ["string", "number", "boolean"].includes(typeof value))
  );
  try {
    window.dispatchEvent(new CustomEvent("chukbti:track", { detail: { name, payload: safePayload } }));
    if (typeof window.chukbtiTrack === "function") window.chukbtiTrack(name, safePayload);
  } catch {
    // 이벤트 추적 실패가 테스트 진행을 막지 않게 합니다.
  }
}
