import { brandSignature } from "./displayLabels.js";
const utf8ToBase64Url = value => {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach(byte => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const base64UrlToUtf8 = value => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export const DEFAULT_PUBLIC_FILTERS = Object.freeze({
  switchTypes: Object.freeze(["클릭키", "택타일", "리니어"]),
  silentValues: Object.freeze(["아니오", "예"])
});

const VALID_SWITCH_TYPES = new Set(DEFAULT_PUBLIC_FILTERS.switchTypes);
const VALID_SILENT_VALUES = new Set(DEFAULT_PUBLIC_FILTERS.silentValues);

function normalizePublicFilters(filters) {
  const switchTypes = [...new Set(filters?.switchTypes || [])].filter(value => VALID_SWITCH_TYPES.has(value));
  const silentValues = [...new Set(filters?.silentValues || [])].filter(value => VALID_SILENT_VALUES.has(value));
  return {
    switchTypes: switchTypes.length ? switchTypes : [...DEFAULT_PUBLIC_FILTERS.switchTypes],
    silentValues: silentValues.length ? silentValues : [...DEFAULT_PUBLIC_FILTERS.silentValues]
  };
}

export function encodeResultPayload(selections, publicFilters = DEFAULT_PUBLIC_FILTERS) {
  return utf8ToBase64Url(JSON.stringify({ v: 2, a: selections, f: normalizePublicFilters(publicFilters) }));
}

export function decodeResultState(value, questions) {
  try {
    if (!value || value.length > 2000) return null;
    const parsed = JSON.parse(base64UrlToUtf8(value));
    if (![1, 2].includes(parsed?.v) || !parsed.a || typeof parsed.a !== "object") return null;
    const selections = {};
    questions.filter(question => question.enabled).forEach(question => {
      const legacyFallback = ["Q12", "Q13"].includes(question.id) ? "B" : undefined;
      const answerId = parsed.a[question.id] ?? legacyFallback;
      if (!question.answers.some(answer => answer.id === answerId)) throw new Error("invalid answer");
      selections[question.id] = answerId;
    });
    return {
      selections,
      publicFilters: parsed.v === 2
        ? normalizePublicFilters(parsed.f)
        : normalizePublicFilters(DEFAULT_PUBLIC_FILTERS)
    };
  } catch {
    return null;
  }
}

export function decodeResultPayload(value, questions) {
  return decodeResultState(value, questions)?.selections || null;
}

export function buildShareUrl(locationLike, selections, publicFilters = DEFAULT_PUBLIC_FILTERS) {
  const url = new URL(locationLike.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("result", encodeResultPayload(selections, publicFilters));
  return url.toString();
}

export function shareMode(navigatorLike) {
  return typeof navigatorLike?.share === "function" ? "web-share" : "copy-link";
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return "clipboard";
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
    return "fallback";
  }
}

function roundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, width, height, radius);
  else {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  ctx.fill();
}

function wrapLines(ctx, text, maxWidth, maxLines = 4) {
  const units = typeof Intl?.Segmenter === "function"
    ? [...new Intl.Segmenter("ko", { granularity: "word" }).segment(text)].map(item => item.segment)
    : [...text];
  const lines = [];
  let line = "";
  units.forEach(unit => {
    const candidate = line + unit;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line.trim());
      line = unit;
    } else line = candidate;
  });
  if (line.trim()) lines.push(line.trim());
  if (lines.length > maxLines) {
    lines.length = maxLines;
    let last = lines[maxLines - 1];
    while (ctx.measureText(last + "…").width > maxWidth && last.length) last = last.slice(0, -1);
    lines[maxLines - 1] = last.trim() + "…";
  }
  return lines;
}

function drawDecoration(ctx, style) {
  const colors = {
    cream: ["#e9b965", "#f6ddad"], warm: ["#d58a45", "#f1be70"],
    cold: ["#8eb7bd", "#d8eeee"], crystal: ["#6b989a", "#d8ece4"],
    heavy: ["#6c4030", "#c28b63"], bright: ["#c65d58", "#edb860"]
  }[style] || ["#e9b965", "#f6ddad"];
  ctx.save();
  ctx.globalAlpha = 0.8;
  for (let index = 0; index < 24; index += 1) {
    const x = 75 + ((index * 137) % 930);
    const y = 80 + ((index * 211) % Math.max(1, ctx.canvas.height - 160));
    ctx.fillStyle = colors[index % 2];
    if (style === "crystal" || style === "cold") {
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-5, -5, 10, 10);
      ctx.rotate(-Math.PI / 4);
      ctx.translate(-x, -y);
    } else {
      ctx.beginPath();
      ctx.arc(x, y, style === "heavy" ? 8 : 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export async function createResultCardBlob(data) {
  if (document.fonts?.ready) await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext("2d");
  const font = '"Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
  const left = 135;
  const contentWidth = 810;
  const drawLines = (text, x, y, { size = 27, weight = 600, color = "#3f291f", width = contentWidth, maxLines = 4, lineHeight = Math.round(size * 1.45) } = {}) => {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${font}`;
    const lines = wrapLines(ctx, text || "", width, maxLines);
    lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
    return y + Math.max(1, lines.length) * lineHeight;
  };
  const drawLabel = (text, x, y) => {
    ctx.fillStyle = "#9b5f37";
    ctx.font = `800 22px ${font}`;
    ctx.fillText(text, x, y);
  };
  const drawRule = y => {
    ctx.strokeStyle = "#e2c79b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(left + contentWidth, y);
    ctx.stroke();
  };

  ctx.fillStyle = "#f5ead5";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawDecoration(ctx, data.decoration);
  ctx.fillStyle = "#fffaf0";
  roundedRect(ctx, 70, 60, 940, 1800, 48);
  ctx.strokeStyle = data.decoration === "heavy" ? "#5c382b" : "#c58a52";
  ctx.lineWidth = data.decoration === "heavy" ? 12 : 4;
  ctx.strokeRect(92, 82, 896, 1756);

  ctx.fillStyle = "#79503a";
  ctx.font = `700 25px ${font}`;
  ctx.fillText(data.serviceName, left, 145);
  drawLines(data.characterLine, left, 205, { size: 23, weight: 500, color: "#9b735c", maxLines: 2, lineHeight: 30 });
  drawLines(data.typeTitle, left, 285, { size: 68, weight: 900, maxLines: 2, lineHeight: 75 });
  drawLines(data.typeDescription, left, 438, { size: 28, weight: 600, color: "#6e4b3a", maxLines: 2, lineHeight: 39 });

  drawRule(530);
  drawLabel("CHARACTER STORY · 캐릭터 해석", left, 580);
  drawLines(data.characterAnalysis, left, 625, { size: 27, weight: 600, color: "#5e4437", maxLines: 4, lineHeight: 39 });

  drawLabel("CLICK FEEL · 어울리는 클릭감", left, 820);
  const rows = data.feelRows.filter(item => ["quiet", "weight", "tactile", "speed"].includes(item.id));
  rows.forEach((row, index) => {
    const column = index % 2;
    const rowIndex = Math.floor(index / 2);
    const x = left + column * 415;
    const y = 850 + rowIndex * 95;
    ctx.fillStyle = "#f1dfbe";
    roundedRect(ctx, x, y, 395, 76, 18);
    ctx.fillStyle = "#79503a";
    ctx.font = `700 21px ${font}`;
    ctx.fillText(row.label, x + 24, y + 31);
    ctx.fillStyle = "#3f291f";
    ctx.font = `800 24px ${font}`;
    ctx.fillText(row.value, x + 24, y + 61);
  });

  drawLabel("BEST MATCH · 가장 어울리는 스위치", left, 1085);
  ctx.fillStyle = "#f6ead5";
  roundedRect(ctx, 115, 1110, 850, 360, 28);
  let switchY = drawLines(data.switchName, 150, 1165, { size: 35, weight: 850, width: 780, maxLines: 2, lineHeight: 43 });
  switchY = drawLines(data.switchMeta, 150, switchY + 2, { size: 21, weight: 650, color: "#8a6957", width: 780, maxLines: 1, lineHeight: 30 });
  drawLabel("이 스위치가 어울리는 이유", 150, switchY + 20);
  drawLines(data.switchReason, 150, switchY + 60, { size: 24, weight: 600, color: "#5e4437", width: 780, maxLines: 4, lineHeight: 34 });

  drawLabel("BONUS · 다른 방향도 어울려요", left, 1495);
  (data.alternatives || []).slice(0, 2).forEach((alternative, index) => {
    const y = 1525 + index * 135;
    ctx.fillStyle = index === 0 ? "#f7e8cc" : "#f2e4d7";
    roundedRect(ctx, 115, y, 850, 115, 23);
    ctx.fillStyle = "#9b5f37";
    ctx.font = `800 20px ${font}`;
    ctx.fillText(alternative.label, 150, y + 35);
    drawLines(alternative.name, 150, y + 72, { size: 25, weight: 800, width: 550, maxLines: 1, lineHeight: 30 });
    ctx.textAlign = "right";
    ctx.fillStyle = "#8a6957";
    ctx.font = `600 19px ${font}`;
    ctx.fillText(alternative.meta, 925, y + 72);
    ctx.textAlign = "left";
  });

  drawRule(1790);
  ctx.fillStyle = "#79503a";
  ctx.font = `700 22px ${font}`;
  ctx.fillText(brandSignature(data.legacyName, data.brandName), left, 1825);
  ctx.textAlign = "right";
  ctx.font = `500 19px ${font}`;
  ctx.fillText(data.pageLabel, left + contentWidth, 1825);
  ctx.textAlign = "left";

  return await new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("이미지 생성 실패")), "image/png", 0.95);
  });
}

export async function saveResultCard(blob, filename) {
  const file = new File([blob], filename, { type: "image/png" });
  const appleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (appleMobile && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: filename });
    return "native-file-share";
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return "download";
}
