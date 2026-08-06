import { readFile, writeFile } from "node:fs/promises";
import { brandConfig } from "../src/publicConfig.js";

const indexUrl = new URL("../index.html", import.meta.url);
let html = await readFile(indexUrl, "utf8");

const escapeAttribute = value => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const replaceMeta = (key, value) => {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const expression = new RegExp('(<meta(?=[^>]*data-config-meta="' + escapedKey + '")[^>]*content=")([^"]*)(")');
  if (expression.test(html)) html = html.replace(expression, "$1" + escapeAttribute(value) + "$3");
};

html = html.replace(/<title data-config-title>.*?<\/title>/, "<title data-config-title>" + brandConfig.meta.pageTitle + "</title>");
replaceMeta("description", brandConfig.meta.pageDescription);
replaceMeta("og:title", brandConfig.meta.ogTitle);
replaceMeta("og:description", brandConfig.meta.ogDescription);
replaceMeta("twitter:card", brandConfig.meta.twitterCard);
replaceMeta("twitter:title", brandConfig.meta.ogTitle);
replaceMeta("twitter:description", brandConfig.meta.ogDescription);

html = html.replace(/\s*<meta[^>]+data-config-meta="(?:og:image|twitter:image)"[^>]*>/g, "");
html = html.replace(/\s*<link[^>]+data-config-asset="favicon"[^>]*>/g, "");
if (brandConfig.assets.representativeImage) {
  const image = escapeAttribute(brandConfig.assets.representativeImage);
  html = html.replace('  <meta name="twitter:card"',
    '  <meta property="og:image" content="' + image + '" data-config-meta="og:image">\n' +
    '  <meta name="twitter:image" content="' + image + '" data-config-meta="twitter:image">\n' +
    '  <meta name="twitter:card"');
}
if (brandConfig.assets.favicon) {
  html = html.replace('  <link rel="stylesheet"',
    '  <link rel="icon" href="' + escapeAttribute(brandConfig.assets.favicon) + '" data-config-asset="favicon">\n' +
    '  <link rel="stylesheet"');
}

await writeFile(indexUrl, html);
console.log("index.html 메타데이터를 publicConfig.js와 동기화했습니다.");
