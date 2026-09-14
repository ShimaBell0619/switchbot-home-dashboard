import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const foundationSha = "007352e15fcc6f9620686d3b77e11e85341eac02";

test("Vercel deploys only production and trusted synthetic preview refs", async () => {
  const vercel = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8"));

  assert.deepEqual(vercel.git.deploymentEnabled, {
    "**": false,
    main: true,
    "preview/**": true,
  });
});

test("Foundation CI is pinned to the adopted immutable commit", async () => {
  const workflow = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
  assert.match(workflow, new RegExp(`web-ci\\.yml@${foundationSha}`));
});

test("required npm quality scripts are real commands", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  for (const script of ["check", "typecheck", "test", "build"]) {
    assert.equal(typeof pkg.scripts[script], "string");
    assert.ok(pkg.scripts[script].trim().length > 0);
    assert.doesNotMatch(pkg.scripts[script], /^(echo|true)(\s|$)/);
  }
});
