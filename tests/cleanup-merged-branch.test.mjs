import assert from "node:assert/strict";
import test from "node:test";
import { validateTarget } from "../scripts/cleanup-merged-branch.mjs";

const repo = "sample/portal";
const headSha = "a".repeat(40);
const pr = {
  number: 28,
  state: "closed",
  merged_at: "2026-10-10T01:00:00Z",
  base: { ref: "main", repo: { full_name: repo } },
  head: { ref: "test/chat-playwright-review", sha: headSha, repo: { full_name: repo } },
};
const event = {
  action: "created",
  comment: { body: "/cleanup-branch", author_association: "OWNER" },
  issue: { number: 28, pull_request: { url: "https://example.invalid/pr" } },
  repository: { full_name: repo },
};
const valid = (overrides = {}) =>
  validateTarget({ event, pr, repo, openPrs: [], ...overrides });

test("allows unchanged merged local feature branch", () => {
  assert.deepEqual(valid(), { branch: "test/chat-playwright-review", expectedSha: headSha });
});

test("rejects unmerged or cross-repo branch deletion", () => {
  for (const candidate of [
    { ...pr, merged_at: null },
    { ...pr, state: "open" },
    { ...pr, base: { ...pr.base, ref: "develop" } },
    { ...pr, head: { ...pr.head, repo: { full_name: "other/repo" } } },
  ]) {
    assert.throws(() => valid({ pr: candidate }));
  }
});

test("rejects unauthorized or ambiguous comment triggers", () => {
  for (const comment of [
    { body: "/cleanup-branch", author_association: "CONTRIBUTOR" },
    { body: "/cleanup-branch main", author_association: "OWNER" },
    { body: "/cleanup-branch\n", author_association: "OWNER" },
  ]) {
    assert.throws(() => valid({ event: { ...event, comment } }));
  }
});

test("protects main, Preview, malformed refs and non-40-character SHA", () => {
  for (const ref of [
    "main",
    "preview/pr-28",
    "test/../main",
    "feat/x//main",
    "test/fail.",
    "test/unsafe:",
    "test/",
  ]) {
    assert.throws(() => valid({ pr: { ...pr, head: { ...pr.head, ref } } }), ref);
  }
  assert.throws(() => valid({ pr: { ...pr, head: { ...pr.head, sha: "abcdef" } } }));
});

test("refuses branches used by another open PR", () => {
  const openPrs = [
    { number: 300, head: { ref: pr.head.ref, repo: { full_name: repo } } },
  ];
  assert.throws(() => valid({ openPrs }), /still used/);
});
