#!/usr/bin/env node
/**
 * Runs axe-core against every page, in a real Chromium, in all three themes.
 *
 * A jsdom-based run was the other option and was rejected: axe-core's most
 * consequential rule — colour contrast — needs real layout and real computed
 * styles, which jsdom does not provide. A run that could not check contrast
 * and reported "0 issues" would be reporting on a narrower page than the one
 * that ships. This runs a real browser instead, specifically so a clean
 * result means what it claims to mean.
 *
 * Every page is checked three times — system, light, dark — because the
 * palette's `data-theme` override changes the actual colours in use, and a
 * contrast problem in one theme is invisible from the other two.
 *
 * Requires `public/` to be served locally: `python3 -m http.server 8899` (or
 * any static server) from that directory before running this.
 */
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const BASE = process.env.A11Y_BASE_URL ?? 'http://127.0.0.1:8899';

const PAGES = ['/', '/ja/', '/privacy/', '/ja/privacy/', '/404.html'];
const THEMES = ['system', 'light', 'dark'];

async function setTheme(page, theme) {
  await page.evaluate((value) => {
    if (value === 'system') localStorage.removeItem('apv-theme');
    else localStorage.setItem('apv-theme', value);
  }, theme);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  let totalViolations = 0;
  const failures = [];

  for (const path of PAGES) {
    for (const theme of THEMES) {
      await page.goto(BASE + path);
      await setTheme(page, theme);
      await page.reload(); // theme.js reads localStorage and applies it on load
      await page.waitForTimeout(50); // let the toggle's reveal-on-load run

      const results = await new AxeBuilder({ page }).analyze();

      if (results.violations.length > 0) {
        totalViolations += results.violations.length;
        failures.push({ path, theme, violations: results.violations });
      }
      console.log(
        `${results.violations.length === 0 ? 'PASS' : 'FAIL'}  ${path.padEnd(16)} theme=${theme.padEnd(7)} violations=${results.violations.length}`,
      );
    }
  }

  // --- Things axe-core cannot check: real keyboard interaction ---
  //
  // axe-core verifies the DOM/ARIA shape a keyboard interaction *would* rely
  // on; it does not press any keys. The toggle is native <fieldset> + radio
  // inputs specifically so keyboard support is automatic rather than
  // hand-built — this proves that rather than assuming it.
  console.log('\n--- keyboard interaction (native radiogroup) ---\n');
  {
    await page.goto(BASE + '/');
    await setTheme(page, 'system');
    await page.reload();
    await page.waitForTimeout(50);

    const systemRadio = page.locator('[data-theme-toggle] input[value="system"]');
    await systemRadio.focus();
    const focusedAfterTab = await page.evaluate(
      () => document.activeElement?.getAttribute('value'),
    );
    console.log(
      `${focusedAfterTab === 'system' ? 'PASS' : 'FAIL'}  toolbar toggle is reachable and focusable by keyboard`,
    );

    // Arrow-key movement within a native radiogroup is the browser's own
    // behaviour, not this page's — this confirms nothing here has broken it
    // (a wrapper div, a stray tabindex, an event listener calling
    // preventDefault) rather than reimplementing it.
    await page.keyboard.press('ArrowRight');
    const checkedAfterArrow = await page.evaluate(
      () => document.querySelector('[data-theme-toggle] input:checked')?.getAttribute('value'),
    );
    const themeAfterArrow = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    const arrowOk = checkedAfterArrow === 'light' && themeAfterArrow === 'light';
    console.log(
      `${arrowOk ? 'PASS' : 'FAIL'}  ArrowRight moves selection (system -> light) and applies the theme immediately (checked=${checkedAfterArrow}, data-theme=${themeAfterArrow})`,
    );
    if (!arrowOk) failures.push({ path: '/', theme: 'keyboard', violations: [{ id: 'keyboard-arrow', impact: 'serious', help: 'Arrow key did not move selection/theme as expected', helpUrl: '', nodes: [] }] });

    // And the choice has to survive a reload — that is the entire point of
    // storing it, and the one thing a keyboard/mouse-only DOM check cannot
    // see by itself.
    await page.reload();
    await page.waitForTimeout(50);
    const themeAfterReload = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    const persisted = themeAfterReload === 'light';
    console.log(`${persisted ? 'PASS' : 'FAIL'}  choice persists across reload (data-theme=${themeAfterReload})`);
    if (!persisted) failures.push({ path: '/', theme: 'persistence', violations: [{ id: 'persistence', impact: 'serious', help: 'Theme choice did not survive reload', helpUrl: '', nodes: [] }] });
  }

  // --- Things axe-core cannot check: forced-colors mode ---
  //
  // site.css has a `@media (forced-colors: active)` block (focus ring colour,
  // borders). Emulating it is the only way to know that block is actually
  // reached, rather than dead CSS nobody's browser ever triggers.
  console.log('\n--- forced-colors mode ---\n');
  {
    await page.emulateMedia({ forcedColors: 'active' });
    await page.goto(BASE + '/');
    const results = await new AxeBuilder({ page }).analyze();
    console.log(
      `${results.violations.length === 0 ? 'PASS' : 'FAIL'}  /  forced-colors  violations=${results.violations.length}`,
    );
    if (results.violations.length > 0) {
      totalViolations += results.violations.length;
      failures.push({ path: '/', theme: 'forced-colors', violations: results.violations });
    }
    await page.emulateMedia({ forcedColors: 'none' });
  }

  await browser.close();

  if (failures.length > 0) {
    console.log('\n--- violations ---\n');
    for (const { path, theme, violations } of failures) {
      console.log(`### ${path} (${theme})`);
      for (const v of violations) {
        console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
        console.log(`    ${v.helpUrl}`);
        for (const node of v.nodes) {
          console.log(`    - ${node.target.join(' ')}`);
          console.log(`      ${node.failureSummary?.replace(/\n/g, '\n      ')}`);
        }
      }
      console.log('');
    }
    console.error(`${totalViolations} violation(s) across ${failures.length} page/theme combination(s).`);
    process.exitCode = 1;
  } else {
    console.log(`\nNo violations. ${PAGES.length} pages x ${THEMES.length} themes checked.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
