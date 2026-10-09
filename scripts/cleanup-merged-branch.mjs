import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SHA = /^[0-9a-f]{40}$/;
const BRANCH = /^(?:feat|fix|docs|test|chore)\/[A-Za-z0-9][A-Za-z0-9._/-]{0,94}$/;

export function validateTarget({ event, pr, repo, openPrs = [] }) {
  if (
    event?.action !== "created" ||
    event?.comment?.body !== "/cleanup-branch" ||
    event?.comment?.author_association !== "OWNER" ||
    !event?.issue?.pull_request ||
    event?.repository?.full_name !== repo ||
    !Number.isInteger(event?.issue?.number) ||
    event.issue.number !== pr?.number
  ) {
    throw new Error("Unauthorized or malformed branch cleanup request");
  }

  if (
    pr?.state !== "closed" ||
    !pr?.merged_at ||
    pr?.base?.ref !== "main" ||
    pr?.base?.repo?.full_name !== repo ||
    pr?.head?.repo?.full_name !== repo
  ) {
    throw new Error("Branch cleanup requires a merged same-repository PR targeting main");
  }

  const name = pr.head.ref;
  if (
    typeof name !== "string" ||
    !BRANCH.test(name) ||
    name.includes("..") ||
    name.includes("//") ||
    name.endsWith(".") ||
    name.endsWith("/")
  ) {
    throw new Error("Branch cleanup target is not an allowed short-lived branch");
  }
  if (typeof pr.head.sha !== "string" || !SHA.test(pr.head.sha)) {
    throw new Error("Expected branch HEAD SHA is invalid");
  }
  if (
    openPrs.some(
      (other) =>
        other?.head?.repo?.full_name === repo &&
        other?.head?.ref === name &&
        other?.number !== pr.number,
    )
  ) {
    throw new Error("Branch is still used by another open pull request");
  }

  return { branch: name, expectedSha: pr.head.sha };
}

function command(name, args) {
  return execFileSync(name, args, { encoding: "utf8", timeout: 30_000 }).trim();
}

export async function cleanup() {
  const repo = process.env.GITHUB_REPOSITORY;
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo) || !eventPath) {
    throw new Error("Missing trusted GitHub event environment");
  }
  if (!process.env.GH_TOKEN) {
    throw new Error("Required workflow GitHub token not available");
  }

  const event = JSON.parse(readFileSync(eventPath, "utf8"));
  const number = event?.issue?.number;
  if (!Number.isInteger(number) || number < 1) throw new Error("Invalid PR number");
  const pr = JSON.parse(command("gh", ["api", `repos/${repo}/pulls/${number}`]));
  const pages = JSON.parse(
    command("gh", ["api", "--paginate", "--slurp", `repos/${repo}/pulls?state=open&per_page=100`]),
  );
  const openPrs = pages.flat();
  const target = validateTarget({ event, pr, repo, openPrs });
  const remoteRef = `refs/heads/${target.branch}`;

  const current = command("git", ["ls-remote", "--heads", "origin", remoteRef]);
  if (!current) {
    console.log(`Already absent: ${target.branch} (no deletion necessary)`);
    return;
  }
  const [actualSha, actualRef] = current.split(/\s+/);
  if (actualRef !== remoteRef || actualSha !== target.expectedSha) {
    throw new Error("Remote branch HEAD has moved since PR merge; refusing deletion");
  }

  // This deletion fails if GitHub sees a different SHA between our check and the push.
  command("git", [
    "push",
    `--force-with-lease=${remoteRef}:${target.expectedSha}`,
    "origin",
    `:${remoteRef}`,
  ]);
  if (command("git", ["ls-remote", "--heads", "origin", remoteRef])) {
    throw new Error("Branch ref remains after attempted cleanup");
  }
  console.log(`Deleted merged PR branch: ${target.branch} (${target.expectedSha})`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cleanup().catch((error) => {
    console.error(`Branch cleanup rejected: ${error.message}`);
    process.exitCode = 1;
  });
}
