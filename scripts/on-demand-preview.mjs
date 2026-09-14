import { appendFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
const repository = process.env.REPOSITORY || process.env.GITHUB_REPOSITORY || '';
const eventPath = process.env.GITHUB_EVENT_PATH || '';

function requireValue(value, label) {
  if (!String(value ?? '').trim()) throw new Error(`${label} is required`);
  return String(value).trim();
}

function eventPayload() {
  return JSON.parse(readFileSync(requireValue(eventPath, 'GITHUB_EVENT_PATH'), 'utf8'));
}

async function githubApi(path, { method = 'GET', body, allow404 = false } = {}) {
  const response = await fetch(`https://api.github.com/${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${requireValue(token, 'GH_TOKEN')}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'web-app-foundation-on-demand-preview',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (allow404 && response.status === 404) return null;
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${method} ${path} failed: ${response.status} ${text}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function git(args, { env = {}, allowFailure = false } = {}) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    if (allowFailure) return '';
    const stderr = error?.stderr ? String(error.stderr) : String(error);
    throw new Error(`git ${args.join(' ')} failed: ${stderr}`);
  }
}

function setOutput(name, value) {
  appendFileSync(requireValue(process.env.GITHUB_OUTPUT, 'GITHUB_OUTPUT'), `${name}=${value}\n`);
}

function sameRepositoryPr(pr, repo) {
  return (
    pr?.state === 'open' &&
    pr?.base?.repo?.full_name === repo &&
    pr?.base?.ref === 'main' &&
    pr?.head?.repo?.full_name === repo &&
    /^[0-9a-f]{40}$/.test(pr?.head?.sha ?? '')
  );
}

function sourceMarkers(message, prNumber, sourceSha) {
  return (
    String(message ?? '').includes(`Foundation-Preview-PR: ${prNumber}`) &&
    String(message ?? '').includes(`Source-PR-HEAD: ${sourceSha}`)
  );
}

async function authorize() {
  const repo = requireValue(repository, 'REPOSITORY');
  const event = eventPayload();
  if (event?.comment?.body !== '/preview' || !event?.issue?.pull_request) {
    throw new Error('request must be an exact /preview comment on a pull request');
  }

  const actor = requireValue(event?.comment?.user?.login || process.env.GITHUB_ACTOR, 'comment author');
  const permission = await githubApi(`repos/${repo}/collaborators/${encodeURIComponent(actor)}/permission`);
  if (!['write', 'maintain', 'admin'].includes(permission?.permission)) {
    throw new Error(`/${actor} is not a repository writer`);
  }

  const prNumber = Number(event.issue.number);
  if (!Number.isSafeInteger(prNumber) || prNumber < 1) throw new Error('invalid PR number');
  const pr = await githubApi(`repos/${repo}/pulls/${prNumber}`);
  if (!sameRepositoryPr(pr, repo)) {
    throw new Error('Preview requires an open same-repository PR targeting main');
  }

  setOutput('pr_number', prNumber);
  setOutput('source_sha', pr.head.sha);
  setOutput('preview_branch', `preview/pr-${prNumber}`);
}

async function publish() {
  const repo = requireValue(repository, 'REPOSITORY');
  const prNumber = Number(requireValue(process.env.PR_NUMBER, 'PR_NUMBER'));
  const sourceSha = requireValue(process.env.SOURCE_SHA, 'SOURCE_SHA');
  const previewBranch = requireValue(process.env.PREVIEW_BRANCH, 'PREVIEW_BRANCH');

  if (!Number.isSafeInteger(prNumber) || prNumber < 1) throw new Error('invalid PR number');
  if (!/^[0-9a-f]{40}$/.test(sourceSha)) throw new Error('invalid source SHA');
  if (previewBranch !== `preview/pr-${prNumber}`) throw new Error('unexpected Preview branch');

  const pr = await githubApi(`repos/${repo}/pulls/${prNumber}`);
  if (!sameRepositoryPr(pr, repo) || pr.head.sha !== sourceSha) {
    throw new Error('PR HEAD changed or is no longer deployable; request /preview again');
  }

  git(['fetch', '--no-tags', 'origin', sourceSha]);
  const sourceTree = git(['show', '-s', '--format=%T', sourceSha]);
  const sourceAuthorName = git(['show', '-s', '--format=%an', sourceSha]);
  const sourceAuthorEmail = git(['show', '-s', '--format=%ae', sourceSha]);
  const remoteRef = `refs/heads/${previewBranch}`;
  const lsRemote = git(['ls-remote', '--heads', 'origin', remoteRef], { allowFailure: true });
  const observed = lsRemote ? lsRemote.split(/\s+/)[0] : '';

  if (observed && /^[0-9a-f]{40}$/.test(observed)) {
    git(['fetch', '--no-tags', 'origin', observed]);
    const existingParent = git(['show', '-s', '--format=%P', observed]);
    const existingTree = git(['show', '-s', '--format=%T', observed]);
    const existingMessage = git(['show', '-s', '--format=%B', observed]);
    if (
      existingParent === sourceSha &&
      existingTree === sourceTree &&
      sourceMarkers(existingMessage, prNumber, sourceSha)
    ) {
      setOutput('synthetic_sha', observed);
      setOutput('reused', 'true');
      return;
    }
  }

  const message = [
    `Foundation On-demand Preview for PR #${prNumber}`,
    '',
    `Foundation-Preview-PR: ${prNumber}`,
    `Source-PR-HEAD: ${sourceSha}`,
  ].join('\n');
  const syntheticSha = execFileSync('git', ['commit-tree', sourceTree, '-p', sourceSha], {
    input: `${message}\n`,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: sourceAuthorName,
      GIT_AUTHOR_EMAIL: sourceAuthorEmail,
      GIT_COMMITTER_NAME: 'github-actions[bot]',
      GIT_COMMITTER_EMAIL: '41898282+github-actions[bot]@users.noreply.github.com',
    },
  }).trim();

  if (git(['show', '-s', '--format=%P', syntheticSha]) !== sourceSha) {
    throw new Error('synthetic Preview commit must have the source SHA as its single parent');
  }
  if (git(['show', '-s', '--format=%T', syntheticSha]) !== sourceTree) {
    throw new Error('synthetic Preview commit tree must equal the source tree');
  }
  git(['diff', '--quiet', sourceSha, syntheticSha]);

  if (observed) {
    git([
      'push',
      'origin',
      `${syntheticSha}:${remoteRef}`,
      `--force-with-lease=${remoteRef}:${observed}`,
    ]);
  } else {
    git(['push', 'origin', `${syntheticSha}:${remoteRef}`]);
  }

  const verified = git(['ls-remote', '--heads', 'origin', remoteRef]).split(/\s+/)[0];
  if (verified !== syntheticSha) throw new Error('synthetic Preview ref verification failed');

  setOutput('synthetic_sha', syntheticSha);
  setOutput('reused', 'false');
}

async function notify() {
  const repo = requireValue(repository, 'REPOSITORY');
  const event = eventPayload();
  const payload = event?.client_payload ?? {};
  const expectedProject = String(process.env.VERCEL_PROJECT_NAME || repo.split('/')[1] || '').trim();

  if (payload.environment !== 'preview') throw new Error('not a Vercel Preview event');
  if (payload?.project?.name !== expectedProject) throw new Error('unexpected Vercel project');
  if (payload?.state?.type !== 'success') throw new Error('Vercel Preview is not ready');

  const previewBranch = String(payload?.git?.ref ?? '');
  const match = /^preview\/pr-([0-9]+)$/.exec(previewBranch);
  if (!match) throw new Error('unexpected Vercel Preview ref');
  const prNumber = Number(match[1]);
  const syntheticSha = String(payload?.git?.sha ?? '');
  const previewUrl = String(payload?.url ?? '');
  const deploymentId = String(payload?.id ?? '');
  const branchAlias = Array.isArray(payload?.alias) ? String(payload.alias[0] ?? '') : '';

  if (!/^[0-9a-f]{40}$/.test(syntheticSha)) throw new Error('invalid synthetic SHA');
  if (!/^https:\/\/[A-Za-z0-9.-]+\.vercel\.app$/.test(previewUrl)) {
    throw new Error('Vercel payload did not contain a generated Preview application URL');
  }

  const pr = await githubApi(`repos/${repo}/pulls/${prNumber}`);
  if (!sameRepositoryPr(pr, repo)) throw new Error('originating PR is no longer deployable');
  const sourceSha = pr.head.sha;

  const ref = await githubApi(`repos/${repo}/git/ref/heads/${previewBranch}`);
  if (ref?.object?.sha !== syntheticSha) throw new Error('stale Vercel event for superseded Preview source');

  const synthetic = await githubApi(`repos/${repo}/git/commits/${syntheticSha}`);
  if (synthetic?.parents?.length !== 1 || synthetic.parents[0]?.sha !== sourceSha) {
    throw new Error('synthetic Preview parent no longer matches current PR HEAD');
  }
  if (!sourceMarkers(synthetic?.message, prNumber, sourceSha)) {
    throw new Error('synthetic Preview commit provenance markers are invalid');
  }
  const source = await githubApi(`repos/${repo}/git/commits/${sourceSha}`);
  if (synthetic?.tree?.sha !== source?.tree?.sha) {
    throw new Error('synthetic Preview tree no longer matches current PR HEAD tree');
  }

  const aliasLine = branchAlias ? `\n- Branch URL: https://${branchAlias}` : '';
  const marker = `<!-- web-app-foundation-preview pr=${prNumber} source=${sourceSha} synthetic=${syntheticSha} -->`;
  const body = [
    'Preview ready.',
    '',
    `- URL: ${previewUrl}`,
    `- Source: \`${sourceSha.slice(0, 7)}\``,
    `- Deployment commit: \`${syntheticSha.slice(0, 7)}\``,
    `- Branch: \`${previewBranch}\``,
    `- Vercel deployment: \`${deploymentId}\`${aliasLine}`,
    '',
    marker,
  ].join('\n');

  await githubApi(`repos/${repo}/issues/${prNumber}/comments`, {
    method: 'POST',
    body: { body },
  });
}

async function cleanup() {
  const repo = requireValue(repository, 'REPOSITORY');
  const event = eventPayload();
  const pr = event?.pull_request;
  const prNumber = Number(pr?.number);
  if (!Number.isSafeInteger(prNumber) || prNumber < 1) throw new Error('invalid closed PR event');
  if (pr?.base?.repo?.full_name !== repo || pr?.head?.repo?.full_name !== repo) return;

  const previewBranch = `preview/pr-${prNumber}`;
  const remoteRef = `refs/heads/${previewBranch}`;
  const lsRemote = git(['ls-remote', '--heads', 'origin', remoteRef], { allowFailure: true });
  if (!lsRemote) return;
  const observed = lsRemote.split(/\s+/)[0];
  if (!/^[0-9a-f]{40}$/.test(observed)) throw new Error('invalid current Preview ref');

  git(['fetch', '--no-tags', 'origin', observed]);
  const message = git(['show', '-s', '--format=%B', observed]);
  if (!String(message).includes(`Foundation-Preview-PR: ${prNumber}`)) {
    throw new Error('refusing to delete a Preview branch without matching ownership marker');
  }

  git([
    'push',
    'origin',
    `:${remoteRef}`,
    `--force-with-lease=${remoteRef}:${observed}`,
  ]);
}

const command = process.argv[2];
const handlers = { authorize, publish, notify, cleanup };
if (!handlers[command]) {
  console.error('usage: node on-demand-preview.mjs <authorize|publish|notify|cleanup>');
  process.exit(2);
}

handlers[command]().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
