#!/usr/bin/env node
/**
 * Renders the OGP / Twitter share images (1200×630, one per locale) from a
 * self-contained HTML template — the same brand mark, wordmark and palette
 * as the pages themselves, always in the light palette so a link preview
 * looks the same regardless of the viewer's OS theme.
 *
 * Rendered with Playwright, the same approach as make-favicons.mjs: real
 * Chromium already draws this correctly, so a second render toolchain (e.g.
 * a standalone image-layout engine) would only add a dependency for two
 * images that change rarely.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

const WIDTH = 1200;
const HEIGHT = 630;
const ACCENT = '#0b57d0';
const FG = '#1b1d21';
const MUTED = '#4b5058';
const BORDER = '#c9cdd4';
const SURFACE = '#f4f6f8';
const CELL = '#e3e7eb';

function markSvg() {
  return `<svg width="56" height="56" viewBox="0 0 32 32" aria-hidden="true" style="flex:none;color:${ACCENT}">
    <rect x="3" y="3" width="26" height="26" rx="3" fill="none" stroke="currentColor" stroke-width="2" />
    <path d="M0 22h16a2 2 0 0 0 2-2v-8a2 2 0 0 1 2-2h12" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round" />
  </svg>`;
}

function arrowSvg() {
  return `<svg width="28" height="36" viewBox="0 0 28 36" aria-hidden="true" style="color:${ACCENT};flex:none">
    <path d="M14 2v26" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
    <path d="M4 22l10 10 10-10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`;
}

/** The "flat PDF text" card turning into the "real headings, list, table" card. */
function diagram() {
  const bar = (w) => `<div style="height:8px;width:${w};background:${BORDER};border-radius:4px"></div>`;
  const listRow = (w) => `<div style="display:flex;align-items:center;gap:8px">
      <div style="width:6px;height:6px;border-radius:50%;background:${MUTED};flex:none"></div>
      <div style="height:7px;width:${w};background:${BORDER};border-radius:4px"></div>
    </div>`;
  const cell = () => `<div style="height:12px;background:${CELL};border:1px solid ${BORDER};border-radius:2px"></div>`;
  const gridRow = () => `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px">${cell()}${cell()}${cell()}</div>`;

  return `<div style="flex:none;width:420px;display:flex;flex-direction:column;align-items:center;gap:16px">
    <div style="width:420px;height:150px;box-sizing:border-box;padding:22px 24px;background:${SURFACE};border:1px solid ${BORDER};border-radius:12px;display:flex;flex-direction:column;justify-content:center;gap:10px">
      ${bar('88%')}${bar('96%')}${bar('72%')}${bar('92%')}${bar('60%')}
    </div>
    ${arrowSvg()}
    <div style="width:420px;height:150px;box-sizing:border-box;padding:20px 24px;background:${SURFACE};border:1px solid ${BORDER};border-radius:12px;display:flex;flex-direction:column;justify-content:center;gap:8px">
      <div style="height:10px;width:56%;background:${ACCENT};border-radius:4px"></div>
      ${listRow('80%')}
      ${listRow('64%')}
      <div style="display:flex;flex-direction:column;gap:4px;margin-top:2px">${gridRow()}${gridRow()}</div>
    </div>
  </div>`;
}

function pageHtml({ lang, tagline }) {
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<style>
  html,body{margin:0;padding:0}
  body{
    font-family: system-ui, -apple-system, 'Hiragino Kaku Gothic ProN', 'Noto Sans JP', 'Yu Gothic', Meiryo, sans-serif;
    background:#ffffff;
  }
</style>
</head>
<body>
  <div style="width:${WIDTH}px;height:${HEIGHT}px;box-sizing:border-box;padding:72px;display:flex;align-items:center;gap:64px;background:#ffffff">
    <div style="flex:1 1 auto;display:flex;flex-direction:column;gap:28px;min-width:0">
      <div style="display:flex;align-items:center;gap:20px">
        ${markSvg()}
        <div style="font-size:56px;font-weight:800;color:${FG};letter-spacing:-0.02em;line-height:1.1">Accessible PDF View</div>
      </div>
      <div style="font-size:32px;font-weight:600;color:${MUTED};line-height:1.35;max-width:560px">${tagline}</div>
      <div style="font-size:22px;font-weight:600;color:${ACCENT};margin-top:8px">accessiblepdfview.org</div>
    </div>
    ${diagram()}
  </div>
</body>
</html>`;
}

const PAGES = [
  { file: 'public/og-image.png', lang: 'en', tagline: 'Read a PDF the way you read a web page.' },
  { file: 'public/ja/og-image.png', lang: 'ja', tagline: 'PDF を見出しから読める文書に' },
];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT } });

  for (const { file, lang, tagline } of PAGES) {
    await page.setContent(pageHtml({ lang, tagline }));
    const png = await page.screenshot();
    const outPath = join(root, file);
    await mkdir(dirname(outPath), { recursive: true });
    await writeFile(outPath, png);
    console.log(`wrote ${file} (${WIDTH}x${HEIGHT})`);
  }

  await browser.close();
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
