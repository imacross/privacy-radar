// Quick visual smoke test: load the app, run a scan, screenshot.
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = process.argv[2] || "cnn.com";
const WAIT = Number(process.argv[3] || 17000);
const OUT = process.argv[4] || "/tmp/pr-app.png";

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
await page.goto("http://localhost:8888/", { waitUntil: "networkidle2" });
await page.type(".scan-input input", URL);
await page.click(".scan-input button");
await new Promise((r) => setTimeout(r, WAIT));
await page.screenshot({ path: OUT });
await browser.close();
console.log("saved", OUT);
