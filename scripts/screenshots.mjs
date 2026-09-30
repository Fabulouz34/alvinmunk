// Drives the White-belt onboarding flow and captures the 3 Level-1 screenshots.
// Uses the built-in dev wallet (Friendbot-funded testnet keypair) — no extension needed.
//
// Base URL: reads PLAYWRIGHT_BASE_URL env var, falls back to http://127.0.0.1:3000
// Handle: generated at runtime — unique per run, never hard-coded.
//
// Usage:
//   node scripts/screenshots.mjs
//   PLAYWRIGHT_BASE_URL=https://alvinmunk.vercel.app node scripts/screenshots.mjs
import { chromium } from 'playwright';

/** Mirror the uniqueHandle() helper used by apps/web/e2e/smoke.spec.ts */
function uniqueHandle() {
  return `e2e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 20);
}

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
const ROOT = new URL('..', import.meta.url).pathname;
const handle = uniqueHandle();

console.log(`Base URL : ${BASE}`);
console.log(`Handle   : ${handle}`);

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 430, height: 932 } });
const page = await ctx.newPage();
page.on('console', (m) => m.type() === 'error' && console.log('PAGE ERROR:', m.text()));

try {
  // Navigate to the onboarding gate — /app shows "Create your profile" when no profile
  // is stored in localStorage (fresh context, which is always the case here).
  await page.goto(`${BASE}/app`, { waitUntil: 'domcontentloaded', timeout: 180_000 });

  // ── Screenshot 1 — Wallet connected ──────────────────────────────────────────
  // The dev wallet initialises in the background; the onboarding form is the visual
  // proof that a Friendbot-funded keypair is ready and the app is connected.
  await page
    .getByRole('heading', { name: /Create your profile/i })
    .waitFor({ timeout: 120_000 });
  await page.waitForTimeout(600); // let any enter-animation settle
  await page.screenshot({ path: `${ROOT}level1-1-wallet-connected.png` });
  console.log('✓ level1-1-wallet-connected.png');

  // ── Fill in the unique handle and submit ─────────────────────────────────────
  // getByLabel('Handle') targets aria-label="Handle" on the <Input> in Onboarding.tsx
  await page.getByLabel('Handle').fill(handle);

  // ── Screenshot 2 — Balance / handle entry ────────────────────────────────────
  // Captures the handle field filled in + availability check, showing the on-chain
  // address is about to be used. Taken just before submit so the UX state is clear.
  await page.waitForTimeout(500); // debounce: let availability check start
  await page.screenshot({ path: `${ROOT}level1-2-balance.png` });
  console.log('✓ level1-2-balance.png');

  // Submit the form — this calls connect() → Friendbot-funds the keypair if needed,
  // then recordGenesis() + claimHandle() (two on-chain transactions).
  await page.getByRole('button', { name: /Create my profile/i }).click();

  // ── Screenshot 3 — Successful testnet transaction ────────────────────────────
  // The smoke test (apps/web/e2e/smoke.spec.ts) waits for the "View profile" link as
  // the definitive sign that both on-chain calls completed. We do the same here.
  await page
    .getByRole('link', { name: /View profile/i })
    .waitFor({ timeout: 240_000 });
  await page.waitForTimeout(600); // let success toast render
  await page.screenshot({ path: `${ROOT}level1-3-testnet-tx.png` });
  console.log('✓ level1-3-testnet-tx.png');

  console.log('\nOK: 3 screenshots written to repo root');
} catch (e) {
  console.error('DRIVER FAILED:', e.message);
  await page.screenshot({ path: `${ROOT}level1-debug.png` }).catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
