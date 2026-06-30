// Builds the downloadable browser-extension bundle:
//   1. copies the latest tracker dataset into the extension,
//   2. renders PNG icons from public/radar.svg (uses local Chrome — skipped if
//      the icons already exist, so this step is not required on CI/Netlify),
//   3. zips extension/ into public/privacy-radar-extension.zip.
//
// Run locally and commit the result (icons + zip), mirroring build:trackers.
//   npm run build:extension

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, copyFileSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ext = resolve(root, "extension");
const iconsDir = resolve(ext, "icons");
const svgPath = resolve(root, "public", "radar.svg");
const zipOut = resolve(root, "public", "privacy-radar-extension.zip");

// --- 1. Sync tracker dataset ------------------------------------------------
mkdirSync(resolve(ext, "lib"), { recursive: true });
copyFileSync(resolve(root, "data", "trackers.json"), resolve(ext, "lib", "trackers.json"));
console.log("✓ trackers.json copied into extension/lib");

// --- 2. Icons ---------------------------------------------------------------
const SIZES = [16, 48, 128];
const haveAllIcons = SIZES.every((s) => existsSync(resolve(iconsDir, `icon${s}.png`)));

if (haveAllIcons) {
  console.log("✓ icons already present — skipping render");
} else {
  await renderIcons();
}

async function renderIcons() {
  mkdirSync(iconsDir, { recursive: true });
  const chromePath = resolveChrome();
  if (!chromePath) {
    console.warn(
      "⚠ No Chrome found (set CHROME_PATH). Skipping icon render — icons must be committed.",
    );
    return;
  }
  const puppeteer = (await import("puppeteer-core")).default;
  const svg = readFileSync(svgPath, "utf8");
  const browser = await puppeteer.launch({ executablePath: chromePath, headless: "new" });
  try {
    for (const size of SIZES) {
      const page = await browser.newPage();
      await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
      const html = `<!doctype html><html><head><style>
        html,body{margin:0;padding:0}
        svg{display:block;width:${size}px;height:${size}px}
      </style></head><body>${svg}</body></html>`;
      await page.setContent(html, { waitUntil: "networkidle0" });
      await page.screenshot({
        path: resolve(iconsDir, `icon${size}.png`),
        omitBackground: true,
        clip: { x: 0, y: 0, width: size, height: size },
      });
      await page.close();
      console.log(`✓ icon${size}.png`);
    }
  } finally {
    await browser.close();
  }
}

function resolveChrome() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  // Best-effort read of .env (gitignored) for the locally configured Chrome.
  try {
    const envFile = readFileSync(resolve(root, ".env"), "utf8");
    const m = envFile.match(/^CHROME_PATH=(.*)$/m);
    if (m && existsSync(m[1].trim())) return m[1].trim();
  } catch {
    /* no .env */
  }
  const fallbacks = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ];
  return fallbacks.find((p) => existsSync(p)) || null;
}

// --- 3. Zip -----------------------------------------------------------------
rmSync(zipOut, { force: true });
// -r recurse, -X strip extra file attrs, exclude OS cruft. Paths are relative to
// extension/ so the archive unzips to a clean folder of the extension files.
execFileSync(
  "zip",
  ["-r", "-X", zipOut, ".", "-x", "*.DS_Store", "-x", "__MACOSX/*"],
  { cwd: ext, stdio: "inherit" },
);
console.log(`✓ wrote ${zipOut}`);
