import { SWITCHES } from "./data/switches.js?v=20260806a";
import { groupSwitchesForCatalog } from "./switchCatalogModel.js";

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);
const formatForce = value => Number.isFinite(value) ? value + "g" : "정보 없음";

function switchCard(sw, index) {
  return '<article class="catalog-card"><div class="catalog-card-top"><span class="catalog-rank">' +
    (index + 1) + '</span><div><p class="catalog-brand">' + escapeHtml(sw.brand) + '</p><h3>' +
    escapeHtml(sw.fullName) + '</h3></div></div><div class="catalog-badges"><span>' +
    escapeHtml(sw.switchType) + '</span><span>' + (sw.silent === "예" ? "저소음" : "일반 소음") +
    '</span></div><dl class="catalog-specs"><div><dt>작동압</dt><dd>' + formatForce(sw.actuationForce) +
    '</dd></div><div><dt>바닥압</dt><dd>' + formatForce(sw.bottomOutForce) +
    '</dd></div><div><dt>눌림</dt><dd>' + escapeHtml(sw.pressTendency) +
    '</dd></div><div><dt>소리</dt><dd>' + escapeHtml(sw.noise) +
    '</dd></div></dl><p class="catalog-feel">' + escapeHtml(sw.feelTags) + '</p></article>';
}

function renderCatalog() {
  document.getElementById("catalogCount").textContent = SWITCHES.length + "개";
  document.getElementById("catalogGroups").innerHTML = groupSwitchesForCatalog(SWITCHES).map(group =>
    '<section class="catalog-group" id="type-' + escapeHtml(group.type) + '"><div class="catalog-group-heading"><div><p class="public-kicker">SWITCH TYPE</p><h2>' +
    escapeHtml(group.type) + '</h2></div><span>' + group.switches.length +
    '개 · 작동압 낮은 순</span></div><div class="catalog-grid">' +
    group.switches.map((sw, index) => switchCard(sw, index)).join("") + '</div></section>'
  ).join("");
}

renderCatalog();
