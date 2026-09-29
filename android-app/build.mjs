// Builds a signed release APK. Used by the GitHub Action and on your laptop.
// Needs these environment variables:
//   KEYSTORE_PATH      path to the .jks signing key
//   KEYSTORE_PASSWORD  its password
//   BUILD_NUMBER       a number that goes up every build (GitHub supplies it)
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const APK_NAME = "whats-4-the-gaff.apk";
const ICON = "whats4thegafficon.png";
const ICON_BG = "#5a3f2c";

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));
const repo = path.resolve(here, "..");
const run = (cmd) => execSync(cmd, { cwd: here, stdio: "inherit" });
const need = (name) => {
  if (!process.env[name]) throw new Error(`Missing environment variable ${name}`);
  return process.env[name];
};

const keystore = path.resolve(need("KEYSTORE_PATH"));
need("KEYSTORE_PASSWORD");
const build = parseInt(process.env.BUILD_NUMBER || "1", 10);

// 1. The app opens the live list; www only holds the "No signal" screen shown when that can't load
fs.rmSync(path.join(here, "www"), { recursive: true, force: true });
fs.mkdirSync(path.join(here, "www"));
fs.copyFileSync(path.join(here, "offline.html"), path.join(here, "www", "index.html"));
fs.copyFileSync(path.join(repo, ICON), path.join(here, "www", ICON));

// 2. Create the Android project (fresh each time, so nothing goes stale)
fs.rmSync(path.join(here, "android"), { recursive: true, force: true });
run("npx cap add android");

// 3. App icon
fs.mkdirSync(path.join(here, "assets"), { recursive: true });
fs.copyFileSync(path.join(repo, ICON), path.join(here, "assets", "icon-only.png"));
fs.copyFileSync(path.join(repo, ICON), path.join(here, "assets", "icon-foreground.png"));
const { default: sharp } = await import("sharp");
await sharp({ create: { width: 1024, height: 1024, channels: 3, background: ICON_BG } })
  .png().toFile(path.join(here, "assets", "icon-background.png"));
run(`npx capacitor-assets generate --android --iconBackgroundColor "${ICON_BG}" --splashBackgroundColor "${ICON_BG}"`);

// 4. Version number: must go up every release so updates install over the old app
const gradleFile = path.join(here, "android", "app", "build.gradle");
let gradle = fs.readFileSync(gradleFile, "utf8");
gradle = gradle.replace(/versionCode \d+/, `versionCode ${build}`)
               .replace(/versionName "[^"]*"/, `versionName "1.${build}"`);
fs.writeFileSync(gradleFile, gradle);

// 5. Build
const win = process.platform === "win32";
const androidDir = path.join(here, "android");
if (!win) fs.chmodSync(path.join(androidDir, "gradlew"), 0o755);
execSync(`"${path.join(androidDir, win ? "gradlew.bat" : "gradlew")}" assembleRelease`,
  { cwd: androidDir, stdio: "inherit" });

// 6. Sign (the password is passed through an environment variable, never on the command line)
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
const tools = path.join(sdk, "build-tools");
const latest = fs.readdirSync(tools).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop();
const tool = (name) => `"${path.join(tools, latest, win ? `${name}${name === "zipalign" ? ".exe" : ".bat"}` : name)}"`;
const out = path.join(here, "android", "app", "build", "outputs", "apk", "release");
const unsigned = path.join(out, "app-release-unsigned.apk");
const aligned = path.join(out, "app-release-aligned.apk");
const final = path.join(here, APK_NAME);
fs.rmSync(aligned, { force: true });
run(`${tool("zipalign")} -p -f 4 "${unsigned}" "${aligned}"`);
run(`${tool("apksigner")} sign --ks "${keystore}" --ks-key-alias release ` +
    `--ks-pass env:KEYSTORE_PASSWORD --key-pass env:KEYSTORE_PASSWORD --out "${final}" "${aligned}"`);
run(`${tool("apksigner")} verify "${final}"`);
console.log(`\nDone: android-app/${APK_NAME} (version 1.${build})`);
