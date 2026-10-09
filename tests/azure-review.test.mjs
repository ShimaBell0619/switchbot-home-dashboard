import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(".github/workflows/azure-review.yml", "utf8");
test("Azure review requires owner exact commands on designated issue", () => {
  for (const fragment of [
    "github.event.issue.number == 32",
    "github.event.comment.author_association == 'OWNER'",
    "github.event.comment.body == '/azure-inventory'",
    "github.event.comment.body == '/azure-what-if'",
    "!github.event.issue.pull_request",
    "ref: main",
  ]) assert.ok(source.includes(fragment), fragment);
});
test("Azure review does not dispatch arbitrary requests or run privileged apply", () => {
  assert.ok(source.includes("permissions: {}"));
  assert.ok(source.includes("id-token: write"));
  assert.ok(source.includes("ResourceIdOnly"));
  assert.ok(source.includes("--validation-level ProviderNoRbac"));
  assert.ok(source.includes('umask 077'));
  assert.ok(source.includes("trap 'rm -rf"));
  assert.doesNotMatch(source, /az deployment group create|az group delete|az resource delete|eval\s/);
  assert.doesNotMatch(source, /secrets\.\w+|github\.event\.comment\.body\s*\}\}\s*\n\s*run:/);
});
