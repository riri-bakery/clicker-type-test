import { AXES } from "./data/questions.js";
import { SWITCHES } from "./data/switches.js?v=20260806a";
import { analyze, buildCharacterProfile, axisPhrase } from "./scoring/engine.js?v=20260806a";
import { loadQuestions, loadProgress, saveProgress, clearProgress } from "./configStore.js";
import { brandConfig, categoryMessages, termHelp } from "./publicConfig.js?v=20260806a";
import { trackEvent } from "./analytics.js";
import {
  alternativeLabel, buildProductLinks, createResultSnapshot, describeCharacter, describeFeel,
  describeOuterInner, describeSwitchContrast, getClickType, resultDecoration, resultNameLine
} from "./resultPresentation.js?v=20260806a";
import {
  buildShareUrl, copyText, createResultCardBlob, decodeResultState, saveResultCard, shareMode
} from "./share.js?v=20260806a";

const dom = Object.fromEntries([
  "configNotice", "introScreen", "nameScreen", "testScreen", "resultScreen", "startTestBtn",
  "backToIntroBtn", "nameForm", "characterName", "privacyNotice", "resetDuringTestBtn",
  "progressText", "progressBar", "questionCategory", "categoryMessage", "questionForm",
  "questionText", "answerList", "questionError", "previousBtn", "nextBtn", "sharedResultNotice",
  "testFromSharedBtn", "resultHero", "resultNameLine", "resultTypeTitle", "resultTypeDescription",
  "characterAnalysis", "outerAnswerText", "interpersonalAnswerText", "innerAnswerText", "outerInnerDescription", "feelGrid",
  "primarySwitch", "switchReason", "switchContrastReason", "termList", "alternativeResults",
  "shareCardPreview", "saveImageBtn", "shareResultBtn", "copyLinkBtn", "shareXBtn", "shareStatus",
  "productTitle", "productDescription", "productFeatures", "productActions", "resultDisclaimer",
  "retestBtn", "restartResultBtn", "adminTools", "profileMetrics", "switchTypeFilter",
  "silentFilter", "excludeSearch", "excludeList", "debugPanel", "debugContent", "productMedia",
  "mediaPlaceholder", "resultProductMedia", "serviceName", "introTitle", "introDescription",
  "brandNote", "headerServiceName", "headerLegacyName", "headerBrandName", "footerBrand", "socialLink",
  "adminToolsLinkContainer", "headerTestDetail", "introQuestionCount", "introTimeEstimate", "introSwitchCount",
  "filteredResultNotice", "refineForm", "refineCandidateCount", "refineError", "refineResultBtn", "resetRefineBtn"
].map(id => [id, document.getElementById(id)]));

const query = new URLSearchParams(location.search);
const adminMode = query.get("admin") === "1";
const debugMode = adminMode && query.get("debug") === "1";
const loadedQuestions = loadQuestions();
const questions = loadedQuestions.questions;
const activeQuestions = questions.filter(question => question.enabled);
const restored = loadProgress();
const sharedResult = decodeResultState(query.get("result"), activeQuestions);
const sharedSelections = sharedResult?.selections || null;
const restoredSelections = restored.selections && typeof restored.selections === "object" ? restored.selections : {};
const complete = selections => activeQuestions.length > 0 && activeQuestions.every(question => selections[question.id]);

let state = {
  phase: ["intro", "name", "questions", "results"].includes(restored.phase) ? restored.phase :
    Object.keys(restoredSelections).length ? "questions" : "intro",
  currentIndex: Math.max(0, Math.min(Number(restored.currentIndex) || 0, Math.max(0, activeQuestions.length - 1))),
  selections: restoredSelections,
  characterName: typeof restored.characterName === "string" ? restored.characterName : "",
  filters: {
    switchType: restored.filters?.switchType || "",
    silent: restored.filters?.silent || ""
  },
  publicFilters: {
    switchTypes: Array.isArray(restored.publicFilters?.switchTypes)
      ? restored.publicFilters.switchTypes.filter(value => ["리니어", "택타일", "클릭키"].includes(value))
      : ["클릭키", "택타일", "리니어"],
    silentValues: Array.isArray(restored.publicFilters?.silentValues)
      ? restored.publicFilters.silentValues.filter(value => ["예", "아니오"].includes(value))
      : ["아니오", "예"]
  },
  excludedNames: Array.isArray(restored.excludedNames) ? restored.excludedNames : []
};
let viewingSharedResult = false;
let lastAnalysis = null;
let lastPresentation = null;
let lastResultSnapshot = null;

if (sharedSelections) {
  state = {
    ...state,
    phase: "results",
    currentIndex: activeQuestions.length - 1,
    selections: sharedSelections,
    characterName: "",
    publicFilters: sharedResult.publicFilters
  };
  viewingSharedResult = true;
} else if (state.phase === "results" && !complete(state.selections)) {
  state.phase = Object.keys(state.selections).length ? "questions" : "intro";
}

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);
const formatScore = value => Number.isFinite(value) ? Math.round(value) : "—";
const formatForce = value => Number.isFinite(value) ? value + "g" : "정보 없음";

function persist() {
  if (!viewingSharedResult) saveProgress(state);
}

function applyBrandConfig() {
  document.title = brandConfig.meta.pageTitle;
  const text = {
    serviceName: brandConfig.serviceName,
    introTitle: brandConfig.introTitle,
    introDescription: brandConfig.description,
    brandNote: brandConfig.brandNote,
    privacyNotice: brandConfig.privacyNotice,
    headerServiceName: brandConfig.serviceName,
    headerLegacyName: brandConfig.legacyName,
    headerBrandName: brandConfig.brandName,
    footerBrand: brandConfig.legacyName + " by " + brandConfig.brandName,
    productTitle: brandConfig.productTitle,
    productDescription: brandConfig.productDescription,
    resultDisclaimer: brandConfig.resultDisclaimer
  };
  Object.entries(text).forEach(([id, value]) => { if (dom[id]) dom[id].textContent = value; });
  document.querySelector('meta[name="description"]')?.setAttribute("content", brandConfig.meta.pageDescription);
  document.querySelector('meta[property="og:title"]')?.setAttribute("content", brandConfig.meta.ogTitle);
  document.querySelector('meta[property="og:description"]')?.setAttribute("content", brandConfig.meta.ogDescription);
  document.querySelector('meta[name="twitter:card"]')?.setAttribute("content", brandConfig.meta.twitterCard);
  document.querySelector('meta[name="twitter:title"]')?.setAttribute("content", brandConfig.meta.ogTitle);
  document.querySelector('meta[name="twitter:description"]')?.setAttribute("content", brandConfig.meta.ogDescription);
  if (brandConfig.assets.favicon) {
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = brandConfig.assets.favicon;
    document.head.append(link);
  }
  dom.productFeatures.innerHTML = brandConfig.productFeatures.map(item => "<li>" + escapeHtml(item) + "</li>").join("");
  dom.introSwitchCount.textContent = SWITCHES.length + "개 스위치";
  if (brandConfig.urls.socialUrl) {
    dom.socialLink.hidden = false;
    dom.socialLink.href = brandConfig.urls.socialUrl;
  }
}

function showPhase(phase, { scroll = true } = {}) {
  state.phase = phase;
  dom.introScreen.hidden = phase !== "intro";
  dom.nameScreen.hidden = phase !== "name";
  dom.testScreen.hidden = phase !== "questions";
  dom.resultScreen.hidden = phase !== "results";
  persist();
  if (phase === "name") {
    dom.characterName.value = state.characterName;
    setTimeout(() => dom.characterName.focus(), 0);
  }
  if (phase === "questions") renderQuestion();
  if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
}

function initialize() {
  applyBrandConfig();
  const estimatedMinutes = Math.max(2, Math.ceil(activeQuestions.length / 5));
  dom.headerTestDetail.textContent = activeQuestions.length + "문항 · 약 " + estimatedMinutes + "분";
  dom.introQuestionCount.textContent = activeQuestions.length + "문항";
  dom.introTimeEstimate.textContent = "약 " + estimatedMinutes + "분";
  bindEvents();
  loadOptionalMedia();
  if (!activeQuestions.length) {
    dom.configNotice.hidden = false;
    dom.configNotice.textContent = "현재 사용할 수 있는 질문이 없습니다. 잠시 후 다시 이용해주세요.";
    dom.startTestBtn.disabled = true;
    showPhase("intro", { scroll: false });
    return;
  }
  if (loadedQuestions.errors.length) {
    dom.configNotice.hidden = false;
    dom.configNotice.textContent = "저장된 테스트 설정을 불러오지 못해 기본 질문으로 진행합니다.";
  }
  dom.characterName.value = state.characterName;
  syncPublicFilterControls();
  dom.switchTypeFilter.value = state.filters.switchType;
  dom.silentFilter.value = state.filters.silent;
  dom.adminTools.hidden = !adminMode;
  if (adminMode) {
    dom.adminToolsLinkContainer.innerHTML = '<a class="button button-secondary" href="./editor.html">질문·데이터 관리</a>';
    renderProfile();
    renderExcludeList();
  }
  if (state.phase === "results" && complete(state.selections)) renderResults({ trackCompletion: false, scroll: false });
  else showPhase(state.phase, { scroll: false });
}

function bindEvents() {
  dom.startTestBtn.addEventListener("click", () => {
    trackEvent("test_start");
    showPhase("name");
  });
  dom.backToIntroBtn.addEventListener("click", () => showPhase("intro"));
  dom.nameForm.addEventListener("submit", event => {
    event.preventDefault();
    state.characterName = dom.characterName.value.trim();
    state.currentIndex = Math.min(state.currentIndex, Math.max(0, activeQuestions.length - 1));
    showPhase("questions");
  });
  dom.characterName.addEventListener("input", event => {
    state.characterName = event.target.value;
    persist();
  });
  dom.questionForm.addEventListener("change", event => {
    if (event.target.name !== "answer") return;
    const question = activeQuestions[state.currentIndex];
    state.selections[question.id] = event.target.value;
    dom.questionError.textContent = "";
    persist();
    renderProgress();
    if (adminMode) renderProfile();
    trackEvent("question_answer", { questionIndex: state.currentIndex + 1, totalQuestions: activeQuestions.length });
  });
  dom.questionForm.addEventListener("keydown", event => {
    const radio = event.target.closest?.('input[type="radio"][name="answer"]');
    if (!radio) return;
    if (["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) {
      event.preventDefault();
      const radios = [...dom.answerList.querySelectorAll('input[type="radio"]')];
      const direction = ["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1;
      const index = radios.indexOf(radio);
      const next = radios[(index + direction + radios.length) % radios.length];
      next.checked = true;
      next.focus();
      next.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    if (![" ", "Space", "Enter"].includes(event.key)) return;
    event.preventDefault();
    radio.checked = true;
    radio.dispatchEvent(new Event("change", { bubbles: true }));
  });
  dom.previousBtn.addEventListener("click", goPrevious);
  dom.nextBtn.addEventListener("click", goNext);
  bindKeyboardActivation(dom.previousBtn, goPrevious);
  bindKeyboardActivation(dom.nextBtn, goNext);
  dom.resetDuringTestBtn.addEventListener("click", () => resetTest(true));
  dom.retestBtn.addEventListener("click", () => resetTest(false));
  dom.restartResultBtn.addEventListener("click", () => resetTest(false));
  dom.testFromSharedBtn.addEventListener("click", () => resetTest(false));
  dom.saveImageBtn.addEventListener("click", saveImage);
  dom.copyLinkBtn.addEventListener("click", copyResultLink);
  dom.shareResultBtn.addEventListener("click", shareResult);
  dom.refineForm.addEventListener("change", updatePublicFilterSummary);
  dom.refineForm.addEventListener("submit", event => {
    event.preventDefault();
    const candidateCount = updatePublicFilterSummary();
    if (!candidateCount) return;
    state.publicFilters = readPublicFilters();
    persist();
    trackEvent("result_refine", {
      switchTypes: state.publicFilters.switchTypes.join(","),
      silentValues: state.publicFilters.silentValues.join(","),
      candidateCount
    });
    renderResults({ trackCompletion: false });
  });
  dom.resetRefineBtn.addEventListener("click", () => {
    state.publicFilters = { switchTypes: ["클릭키", "택타일", "리니어"], silentValues: ["아니오", "예"] };
    syncPublicFilterControls();
    persist();
    renderResults({ trackCompletion: false });
  });
  dom.switchTypeFilter.addEventListener("change", event => {
    state.filters.switchType = event.target.value;
    persist();
    if (state.phase === "results") renderResults({ trackCompletion: false });
  });
  dom.silentFilter.addEventListener("change", event => {
    state.filters.silent = event.target.value;
    persist();
    if (state.phase === "results") renderResults({ trackCompletion: false });
  });
  dom.excludeSearch.addEventListener("input", () => renderExcludeList(dom.excludeSearch.value));
  dom.excludeList.addEventListener("change", event => {
    if (!event.target.matches("[data-switch-name]")) return;
    const name = event.target.dataset.switchName;
    state.excludedNames = event.target.checked
      ? [...new Set([...state.excludedNames, name])]
      : state.excludedNames.filter(item => item !== name);
    persist();
    if (state.phase === "results") renderResults({ trackCompletion: false });
  });
}

function bindKeyboardActivation(element, action) {
  element.addEventListener("keydown", event => {
    if (![" ", "Space", "Enter"].includes(event.key)) return;
    event.preventDefault();
    action();
  });
}

function renderQuestion() {
  const question = activeQuestions[state.currentIndex];
  if (!question) return;
  dom.questionCategory.textContent = question.category;
  dom.categoryMessage.textContent = categoryMessages[question.category] || "캐릭터의 결을 조금 더 자세히 살펴보고 있어요.";
  dom.questionText.textContent = question.question;
  dom.answerList.innerHTML = question.answers.map(answer => {
    const id = "answer-" + question.id + "-" + answer.id;
    const checked = state.selections[question.id] === answer.id ? " checked" : "";
    return '<div class="answer-option"><input type="radio" name="answer" id="' + escapeHtml(id) +
      '" value="' + escapeHtml(answer.id) + '"' + checked + '><label for="' + escapeHtml(id) +
      '"><span class="answer-letter">' + escapeHtml(answer.id) + "</span><span>" +
      escapeHtml(answer.text) + "</span></label></div>";
  }).join("");
  dom.previousBtn.disabled = state.currentIndex === 0;
  dom.nextBtn.textContent = state.currentIndex === activeQuestions.length - 1 ? "결과 보기" : "다음";
  dom.questionError.textContent = "";
  renderProgress();
}

function renderProgress() {
  dom.progressText.textContent = (state.currentIndex + 1) + " / " + activeQuestions.length;
  dom.progressBar.style.width = ((state.currentIndex + 1) / activeQuestions.length * 100) + "%";
  dom.progressBar.parentElement.setAttribute("aria-valuenow", String(state.currentIndex + 1));
  dom.progressBar.parentElement.setAttribute("aria-valuemax", String(activeQuestions.length));
  dom.progressBar.parentElement.setAttribute("role", "progressbar");
}

function goPrevious() {
  if (state.currentIndex <= 0) return;
  state.currentIndex -= 1;
  persist();
  renderQuestion();
}

function goNext() {
  const current = activeQuestions[state.currentIndex];
  if (!state.selections[current.id]) {
    dom.questionError.textContent = "캐릭터에게 가장 가까운 답변을 하나 골라주세요.";
    dom.answerList.querySelector("input")?.focus();
    return;
  }
  if (state.currentIndex < activeQuestions.length - 1) {
    state.currentIndex += 1;
    persist();
    renderQuestion();
    dom.testScreen.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  const unanswered = activeQuestions.find(question => !state.selections[question.id]);
  if (unanswered) {
    state.currentIndex = activeQuestions.indexOf(unanswered);
    renderQuestion();
    dom.questionError.textContent = "아직 답하지 않은 질문이 있어요.";
    persist();
    return;
  }
  renderResults({ trackCompletion: true });
}

function selectedAnswer(scope) {
  const question = activeQuestions.find(item => item.scope === scope);
  const answer = question?.answers.find(item => item.id === state.selections[question.id]);
  return answer ? { question, answer } : null;
}

function selectedQuestionAnswer(questionId) {
  const question = activeQuestions.find(item => item.id === questionId);
  const answer = question?.answers.find(item => item.id === state.selections[question.id]);
  return answer ? { question, answer } : null;
}

function renderResults({ trackCompletion = false, scroll = true } = {}) {
  const publicFilters = state.publicFilters || { switchTypes: ["클릭키", "택타일", "리니어"], silentValues: ["아니오", "예"] };
  lastAnalysis = analyze({
    questions,
    selections: state.selections,
    switches: SWITCHES,
    filters: {
      ...publicFilters,
      ...(adminMode ? { ...state.filters, excludedNames: state.excludedNames } : {})
    }
  });
  const top = lastAnalysis.rankings.slice(0, 3);
  if (!top.length) {
    dom.configNotice.hidden = false;
    dom.configNotice.textContent = "현재 조건에 맞는 추천을 찾지 못했습니다. 운영자 필터를 조정해주세요.";
    return;
  }
  const profile = lastAnalysis.character.overallProfile;
  const clickType = getClickType(profile, lastAnalysis.character.outerProfile, lastAnalysis.character.innerProfile);
  const outer = selectedAnswer("outer");
  const inner = selectedAnswer("inner");
  const interpersonal = selectedQuestionAnswer("Q4");
  const characterContrast = describeOuterInner({
    outerText: outer?.answer.text || "처음의 인상",
    innerText: inner?.answer.text || "가까워진 뒤의 모습",
    outerProfile: lastAnalysis.character.outerProfile,
    innerProfile: lastAnalysis.character.innerProfile,
    interpersonalProfile: lastAnalysis.character.interpersonalProfile,
    overallProfile: profile,
    contrastAssessment: lastAnalysis.character.contrastAssessment
  });
  const feelRows = describeFeel(profile);
  const characterStory = describeCharacter(profile);
  const primaryReason = publicSwitchReason(top[0]);
  lastPresentation = {
    clickType, characterContrast, feelRows, characterStory, primaryReason,
    primary: top[0], alternatives: top.slice(1)
  };
  lastResultSnapshot = createResultSnapshot({
    characterName: state.characterName.trim(), selections: state.selections, analysis: lastAnalysis, clickType
  });

  const displayName = state.characterName.trim();
  dom.resultNameLine.textContent = resultNameLine(displayName);
  dom.resultTypeTitle.textContent = clickType.title;
  dom.resultTypeDescription.textContent = clickType.description;
  dom.resultHero.className = "result-hero decoration-" + resultDecoration(profile);
  dom.characterAnalysis.textContent = characterStory;
  dom.outerAnswerText.textContent = outer?.answer.text || "—";
  dom.interpersonalAnswerText.textContent = interpersonal?.answer.text || "—";
  dom.innerAnswerText.textContent = inner?.answer.text || "—";
  dom.outerInnerDescription.textContent = characterContrast.text;
  dom.feelGrid.innerHTML = feelRows.map(item => '<div class="feel-item"><span>' + escapeHtml(item.label) +
    "</span><b>" + escapeHtml(item.value) + "</b></div>").join("");
  dom.primarySwitch.innerHTML = primarySwitchMarkup(top[0]);
  dom.switchReason.textContent = primaryReason;
  dom.switchContrastReason.textContent = describeSwitchContrast(top[0], characterContrast);
  dom.termList.innerHTML = Object.entries(termHelp).map(([term, explanation]) =>
    "<dt>" + escapeHtml(term) + "</dt><dd>" + escapeHtml(explanation) + "</dd>"
  ).join("");
  dom.alternativeResults.innerHTML = top.slice(1).map(item => alternativeMarkup(top[0], item)).join("");
  renderSharePreview(displayName, lastPresentation);
  renderProductActions();
  configureShareLinks(clickType);
  dom.sharedResultNotice.hidden = !viewingSharedResult;
  renderFilteredResultNotice(lastAnalysis.rankings.length);
  syncPublicFilterControls();
  dom.debugPanel.hidden = !debugMode;
  if (debugMode) renderDebug(lastAnalysis);
  showPhase("results", { scroll: false });
  if (trackCompletion) {
    trackEvent("test_complete", { resultTypeId: clickType.id, totalQuestions: activeQuestions.length });
  }
  if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
}

function primarySwitchMarkup(result) {
  const sw = result.switch;
  return '<div class="switch-card-head"><div><p class="public-kicker">BEST MATCH</p><h3>' +
    escapeHtml(sw.fullName) + '</h3><p class="switch-brand">' + escapeHtml(sw.brand) +
    ' · ' + escapeHtml(sw.switchType) + '</p></div><div class="match-score">' + formatScore(result.finalScore) + "점" +
    '<small>캐릭터 매칭</small></div></div><div class="switch-specs">' +
    switchSpec("소음 설계", sw.silent === "예" ? "저소음" : "일반 소음") +
    switchSpec("작동압", formatForce(sw.actuationForce)) + switchSpec("바닥압", formatForce(sw.bottomOutForce)) +
    switchSpec("소리", sw.noise) + switchSpec("손끝 걸림", sw.tactileStrength) +
    switchSpec("반응", sw.responseSpeed) + switchSpec("온도", sw.temperature) + switchSpec("선명도", sw.clarity) +
    "</div>";
}

function switchSpec(label, value) {
  return "<div><span>" + escapeHtml(label) + "</span><b>" + escapeHtml(value ?? "정보 없음") + "</b></div>";
}

function publicSwitchReason(result) {
  const phrases = result.topAxes.map(item => axisPhrase(item.axis, result.switch.profile[item.axis]));
  const sentence = phrases.length ? phrases.join(", ") + " 등이 " : "확인된 손끝 감각이 ";
  const sheetNote = result.switch.matchPoint || result.switch.mood;
  const polishedNote = sheetNote?.replace(/[.!?。]$/, "")
    .replace(/잘 어울림$/, "잘 어울립니다")
    .replace(/좋음$/, "좋습니다")
    .replace(/쉬움$/, "쉽습니다")
    .replace(/분명함$/, "분명합니다");
  const note = polishedNote ? " " + polishedNote + "." : "";
  return sentence + "캐릭터의 핵심적인 분위기와 잘 맞습니다." + note;
}

function alternativeMarkup(primary, result) {
  const sw = result.switch;
  return '<article class="alternative-card"><span class="alternative-label">' +
    escapeHtml(alternativeLabel(primary, result)) + "</span><h3>" + escapeHtml(sw.fullName) +
    '</h3><div class="alternative-meta">' + escapeHtml(sw.brand) + " · " + escapeHtml(sw.switchType) +
    " · 매칭 " + formatScore(result.finalScore) + "</div><p>" + escapeHtml(publicSwitchReason(result)) + "</p></article>";
}

function renderSharePreview(name, presentation) {
  const { clickType, feelRows, primary, alternatives, characterStory, primaryReason } = presentation;
  const rows = feelRows.filter(item => ["quiet", "weight", "tactile", "speed"].includes(item.id));
  dom.shareCardPreview.className = "share-card-preview decoration-" + resultDecoration(lastAnalysis.character.overallProfile);
  dom.shareCardPreview.innerHTML = '<p class="public-kicker">' + escapeHtml(brandConfig.serviceName) +
    "</p><h3>" + escapeHtml(clickType.title) + "</h3><p>" + escapeHtml(name ? name + "의 클릭 타입" : clickType.description) +
    '</p><div class="share-preview-story"><span>캐릭터 해석</span><p>' + escapeHtml(characterStory) +
    '</p></div><div class="share-preview-feels">' + rows.map(row => "<div><span>" + escapeHtml(row.label) +
    "</span><b>" + escapeHtml(row.value) + "</b></div>").join("") + '</div><div class="share-preview-switch"><span>가장 어울리는 스위치</span><b>' +
    escapeHtml(primary.switch.fullName) + '</b><p class="share-preview-reason">' + escapeHtml(primaryReason) +
    '</p></div><div class="share-preview-bonus"><span>다른 방향 보너스</span>' +
    alternatives.map(item => '<p><b>' + escapeHtml(alternativeLabel(primary, item)) + '</b> · ' +
      escapeHtml(item.switch.fullName) + '</p>').join("") + '</div><span class="share-preview-brand">' +
    escapeHtml(brandConfig.legacyName + " by " + brandConfig.brandName) + "</span>";
}

function configureShareLinks(clickType) {
  const url = buildShareUrl(location, state.selections, state.publicFilters);
  const text = clickType.title + " · " + clickType.description + "\n" + brandConfig.share.text;
  dom.shareXBtn.hidden = !brandConfig.share.xEnabled;
  dom.shareXBtn.href = "https://twitter.com/intent/tweet?" + new URLSearchParams({ text, url }).toString();
  dom.shareResultBtn.textContent = shareMode(navigator) === "web-share" ? "친구에게 테스트 보내기" : "친구에게 링크 복사하기";
}

function renderProductActions() {
  const links = buildProductLinks(brandConfig.urls);
  dom.productActions.hidden = links.length === 0;
  dom.productActions.innerHTML = links.map(([url, label, eventName, destination]) =>
    '<a class="button button-secondary" href="' + escapeHtml(url) + '" target="_blank" rel="noopener" data-track="' +
    eventName + '" data-destination="' + destination + '">' + escapeHtml(label) + "</a>"
  ).join("");
  dom.productActions.querySelectorAll("[data-track]").forEach(link => {
    link.addEventListener("click", () => trackEvent(link.dataset.track, { destination: link.dataset.destination }));
  });
}

async function copyResultLink() {
  const url = buildShareUrl(location, state.selections, state.publicFilters);
  await copyText(url);
  dom.shareStatus.textContent = "결과 링크를 복사했어요. 캐릭터 이름은 링크에 포함되지 않습니다.";
  trackEvent("result_share", { shareMethod: "copy_link" });
}

async function shareResult() {
  const url = buildShareUrl(location, state.selections, state.publicFilters);
  if (shareMode(navigator) !== "web-share") {
    await copyResultLink();
    return;
  }
  try {
    await navigator.share({
      title: brandConfig.meta.ogTitle,
      text: lastPresentation.clickType.title + " · " + lastPresentation.clickType.description,
      url
    });
    dom.shareStatus.textContent = "공유 메뉴를 열었어요.";
    trackEvent("result_share", { shareMethod: "web_share" });
  } catch (error) {
    dom.shareStatus.textContent = error?.name === "AbortError" ? "공유를 취소했어요." : "공유를 열지 못해 링크를 복사했어요.";
    if (error?.name !== "AbortError") await copyText(url);
  }
}

async function saveImage() {
  if (!lastPresentation || !lastAnalysis) return;
  dom.saveImageBtn.disabled = true;
  dom.shareStatus.textContent = "결과 카드를 만들고 있어요…";
  try {
    const name = state.characterName.trim();
    const blob = await createResultCardBlob({
      serviceName: brandConfig.serviceName,
      legacyName: brandConfig.legacyName,
      brandName: brandConfig.brandName,
      characterLine: name ? name + "의 클릭 타입은" : "이 캐릭터의 클릭 타입은",
      typeTitle: lastPresentation.clickType.title,
      typeDescription: lastPresentation.clickType.description,
      characterAnalysis: lastPresentation.characterStory,
      feelRows: lastPresentation.feelRows,
      switchName: lastPresentation.primary.switch.fullName,
      switchMeta: lastPresentation.primary.switch.brand + " · " + lastPresentation.primary.switch.switchType,
      switchReason: lastPresentation.primaryReason,
      alternatives: lastPresentation.alternatives.map(item => ({
        label: alternativeLabel(lastPresentation.primary, item),
        name: item.switch.fullName,
        meta: item.switch.brand + " · " + item.switch.switchType
      })),
      decoration: resultDecoration(lastAnalysis.character.overallProfile),
      pageLabel: location.hostname || brandConfig.serviceName
    });
    const safeName = (name || "캐릭터").replace(/[\\/:*?"<>|]/g, "").slice(0, 24) || "캐릭터";
    const method = await saveResultCard(blob, safeName + "-클릭-타입.png");
    dom.shareStatus.textContent = method === "native-file-share" ? "이미지를 저장하거나 공유할 수 있는 메뉴를 열었어요." : "결과 이미지를 저장했어요.";
    trackEvent("result_image_download", { shareMethod: method });
  } catch (error) {
    dom.shareStatus.textContent = error?.name === "AbortError" ? "이미지 저장을 취소했어요." : "이미지를 만들지 못했어요. 잠시 후 다시 시도해주세요.";
  } finally {
    dom.saveImageBtn.disabled = false;
  }
}

function resetTest(ask) {
  if (ask && !confirm("현재 답변을 지우고 처음부터 다시 시작할까요?")) return;
  clearProgress();
  viewingSharedResult = false;
  state = {
    phase: "name", currentIndex: 0, selections: {}, characterName: "",
    filters: { switchType: "", silent: "" },
    publicFilters: { switchTypes: ["클릭키", "택타일", "리니어"], silentValues: ["아니오", "예"] },
    excludedNames: []
  };
  lastAnalysis = null;
  lastPresentation = null;
  lastResultSnapshot = null;
  dom.characterName.value = "";
  dom.shareStatus.textContent = "";
  dom.debugPanel.hidden = true;
  dom.switchTypeFilter.value = "";
  dom.silentFilter.value = "";
  syncPublicFilterControls();
  dom.excludeSearch.value = "";
  if (adminMode) {
    renderProfile();
    renderExcludeList();
  }
  saveProgress(state);
  showPhase("name");
  trackEvent("retest_click");
}

function readPublicFilters() {
  return {
    switchTypes: [...dom.refineForm.querySelectorAll('input[name="publicSwitchType"]:checked')].map(input => input.value),
    silentValues: [...dom.refineForm.querySelectorAll('input[name="publicSilent"]:checked')].map(input => input.value)
  };
}

function publicCandidateCount(filters) {
  return SWITCHES.filter(sw =>
    filters.switchTypes.includes(sw.switchType) && filters.silentValues.includes(sw.silent)
  ).length;
}

function updatePublicFilterSummary() {
  const filters = readPublicFilters();
  const count = publicCandidateCount(filters);
  dom.refineCandidateCount.textContent = "현재 조건에 맞는 축 " + count + "개";
  dom.refineError.textContent = count ? "" : "선택한 조건에 맞는 보유 스위치가 없습니다. 타입이나 소음 조건을 더 선택해 주세요.";
  dom.refineResultBtn.disabled = count === 0;
  return count;
}

function syncPublicFilterControls() {
  if (!dom.refineForm) return;
  const filters = state.publicFilters || { switchTypes: ["클릭키", "택타일", "리니어"], silentValues: ["아니오", "예"] };
  dom.refineForm.querySelectorAll('input[name="publicSwitchType"]').forEach(input => {
    input.checked = filters.switchTypes.includes(input.value);
  });
  dom.refineForm.querySelectorAll('input[name="publicSilent"]').forEach(input => {
    input.checked = filters.silentValues.includes(input.value);
  });
  updatePublicFilterSummary();
}

function renderFilteredResultNotice(candidateCount) {
  const filters = state.publicFilters;
  const isAll = filters.switchTypes.length === 3 && filters.silentValues.length === 2;
  dom.filteredResultNotice.hidden = isAll;
  if (isAll) return;
  const typeText = filters.switchTypes.join(" · ");
  const noiseText = filters.silentValues.map(value => value === "예" ? "저소음" : "일반 소음").join(" · ");
  dom.filteredResultNotice.textContent = "선택 조건으로 다시 추천한 결과 · " + typeText + " / " + noiseText + " · " + candidateCount + "개 후보";
}

function renderProfile() {
  const profile = buildCharacterProfile(questions, state.selections).profile;
  dom.profileMetrics.innerHTML = AXES.map(axis => '<div class="metric"><span>' + escapeHtml(axis.label) +
    "</span><b>" + (Number.isFinite(profile[axis.id]) ? Math.round(profile[axis.id]) : "—") + "</b></div>").join("");
}

function renderExcludeList(filter = "") {
  const term = filter.trim().toLocaleLowerCase("ko");
  dom.excludeList.innerHTML = SWITCHES.filter(sw =>
    (sw.fullName + " " + sw.brand).toLocaleLowerCase("ko").includes(term)
  ).map(sw => '<label class="exclude-item"><input type="checkbox" data-switch-name="' +
    escapeHtml(sw.fullName) + '"' + (state.excludedNames.includes(sw.fullName) ? " checked" : "") +
    "><span>" + escapeHtml(sw.fullName) + "</span></label>").join("");
}

function renderDebug(analysis) {
  const rows = analysis.rankings.slice(0, 10).map((item, index) => {
    const profile = AXES.map(axis => axis.id + ":" + formatScore(item.switch.profile[axis.id])).join(" ");
    return "<tr><td>" + (index + 1) + "</td><td>" + escapeHtml(item.switch.fullName) + "</td><td>" +
      formatScore(item.baseScore) + "</td><td>" + formatScore(item.contrastBonus) + "</td><td>" +
      formatScore(item.finalScore) + "</td><td>" + escapeHtml(item.physical.excludedAxes.join(", ") || "없음") +
      "</td><td>" + escapeHtml(profile) + "</td></tr>";
  }).join("");
  dom.debugContent.innerHTML =
    debugBlock("선택한 답변과 점수 기여", analysis.character.contributions) +
    debugBlock("최종 캐릭터 8축", analysis.character.overallProfile) +
    debugBlock("outerProfile", analysis.character.outerProfile) +
    debugBlock("innerProfile", analysis.character.innerProfile) +
    debugBlock("commonProfile", analysis.character.commonProfile) +
    debugBlock("contrastAssessment", analysis.character.contrastAssessment) +
    '<div class="debug-block"><h3>상위 10개 스위치 전체 순위</h3><table class="debug-table"><thead><tr><th>#</th><th>스위치</th><th>기본(80)</th><th>반전 보너스(20)</th><th>최종</th><th>결측축</th><th>정규화 8축</th></tr></thead><tbody>' +
    rows + "</tbody></table></div>";
}

function debugBlock(title, value) {
  return '<div class="debug-block"><h3>' + escapeHtml(title) + '</h3><div class="profile-json">' +
    escapeHtml(JSON.stringify(value, null, 2)) + "</div></div>";
}

function loadOptionalMedia() {
  const showAsset = element => {
    dom.mediaPlaceholder.hidden = true;
    dom.productMedia.append(element);
    const resultClone = element.cloneNode(true);
    if (resultClone.tagName === "VIDEO") resultClone.controls = true;
    dom.resultProductMedia.innerHTML = "";
    dom.resultProductMedia.append(resultClone);
  };
  if (brandConfig.assets.productIntroImage) {
    const image = new Image();
    image.className = "hero-media-asset";
    image.alt = brandConfig.brandName + " 제품 이미지";
    image.decoding = "async";
    image.addEventListener("load", () => showAsset(image), { once: true });
    image.addEventListener("error", () => tryVideo(), { once: true });
    image.src = brandConfig.assets.productIntroImage;
  } else tryVideo();

  function tryVideo() {
    if (!brandConfig.assets.productClickVideo) return;
    const video = document.createElement("video");
    video.className = "hero-media-asset";
    video.controls = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    video.addEventListener("loadedmetadata", () => showAsset(video), { once: true });
    video.src = brandConfig.assets.productClickVideo;
  }
}

export function getLastResultSnapshot() {
  return lastResultSnapshot ? structuredClone(lastResultSnapshot) : null;
}

initialize();
