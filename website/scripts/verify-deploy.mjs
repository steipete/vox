import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const configuredBase = process.env.VITE_BASE ?? "/";
const base = `/${configuredBase.replace(/^\/+|\/+$/g, "")}`.replace(/^\/$/, "") + "/";
const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const assetDirectory = new URL("../dist/assets/", import.meta.url);
const scripts = (await readdir(assetDirectory)).filter((file) => file.endsWith(".js"));
const scriptSource = (
  await Promise.all(scripts.map((file) => readFile(new URL(file, assetDirectory), "utf8")))
).join("\n");
const cname = await readFile(new URL("../dist/CNAME", import.meta.url), "utf8");

assert.match(html, new RegExp(`href=["']${escapeRegex(base)}vox-logo\\.svg["']`));
assert.match(html, new RegExp(`(?:src|href)=["']${escapeRegex(base)}assets/`));
assert.match(html, /<link rel="canonical" href="https:\/\/voxcli\.sh\/"/);
assert.match(html, /<meta property="og:url" content="https:\/\/voxcli\.sh\/"/);
assert.match(html, /<meta property="og:image" content="https:\/\/voxcli\.sh\/og-image\.png"/);
assert.match(html, /<meta name="twitter:image" content="https:\/\/voxcli\.sh\/og-image\.png"/);
assert.ok(scriptSource.includes(`${base}vox-logo.svg`), "preloader logo must use the build base");
assert.equal(cname.trim(), "voxcli.sh");
if (base !== "/") {
  assert.doesNotMatch(html, /(?:src|href)=["']\/(?:assets\/|vox-logo\.svg)/);
}

console.log(`verified deploy HTML for base ${base}`);

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
