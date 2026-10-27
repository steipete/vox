import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("CLI version output stays clean when a dotenv file is loaded", (t) => {
  const cwd = mkdtempSync(join(tmpdir(), "vox-cli-env-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  writeFileSync(join(cwd, ".env"), "VOX_TEST_VALUE=from-file\n");

  const result = spawnSync(
    process.execPath,
    [
      "--import",
      import.meta.resolve("tsx"),
      fileURLToPath(new URL("../src/cli.ts", import.meta.url)),
      "--version",
    ],
    { cwd, env: { PATH: process.env.PATH }, encoding: "utf8", timeout: 10_000 },
  );
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, `${pkg.version}\n`);
  assert.equal(result.stderr, "");
});

test("dotenv keeps file values and existing environment precedence without logging", (t) => {
  const cwd = mkdtempSync(join(tmpdir(), "vox-cli-env-"));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  writeFileSync(
    join(cwd, ".env"),
    'VOX_TEST_VALUE="from file # literal"\nVOX_TEST_EXISTING=from-file\n',
  );

  const script = `import ${JSON.stringify(import.meta.resolve("dotenv/config"))};
    process.stdout.write(JSON.stringify([process.env.VOX_TEST_VALUE, process.env.VOX_TEST_EXISTING]));`;
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", script], {
    cwd,
    env: { PATH: process.env.PATH, VOX_TEST_EXISTING: "from-shell" },
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), ["from file # literal", "from-shell"]);
  assert.equal(result.stderr, "");
});
