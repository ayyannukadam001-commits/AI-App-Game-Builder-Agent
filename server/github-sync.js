const API = "https://api.github.com";

function headers(token) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json"
  };
}

async function githubRequest(token, url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...headers(token), ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = body?.message || response.statusText;
    throw new Error(`GitHub API ${response.status}: ${detail}`);
  }
  return body;
}

export function getGitHubSyncConfig(env = process.env) {
  return {
    configured: Boolean((env.GITHUB_TOKEN || env.GH_TOKEN) && env.GITHUB_REPOSITORY),
    repository: env.GITHUB_REPOSITORY || "",
    token: env.GITHUB_TOKEN || env.GH_TOKEN || ""
  };
}

export async function syncAndroidProjectToGitHub({ files, projectId, env = process.env }) {
  const config = getGitHubSyncConfig(env);
  if (!config.configured) {
    throw new Error("GitHub sync is not configured. Add GITHUB_TOKEN and GITHUB_REPOSITORY to the backend environment.");
  }
  if (!/^[0-9a-f-]{36}$/i.test(projectId || "")) throw new Error("Invalid project ID.");
  if (!Array.isArray(files) || files.length < 6 || files.length > 20) throw new Error("Only complete Android projects with 6–20 files can be synced.");
  const ownerRepo = config.repository.split("/");
  if (ownerRepo.length !== 2 || ownerRepo.some(part => !/^[A-Za-z0-9_.-]+$/.test(part))) throw new Error("GITHUB_REPOSITORY must use owner/repository format.");

  const owner = ownerRepo[0];
  const repo = ownerRepo[1];
  const api = `${API}/repos/${owner}/${repo}`;
  const base = await githubRequest(config.token, `${api}/git/ref/heads/main`).catch(async error => {
    if (!String(error.message).includes("404")) throw error;
    const repository = await githubRequest(config.token, api);
    return githubRequest(config.token, `${api}/git/ref/heads/${repository.default_branch}`);
  });
  const baseBranch = base.ref.split("/").slice(2).join("/");
  const baseSha = base.object.sha;
  const branch = `generated/project-${projectId.slice(0, 8)}`;
  const created = await githubRequest(config.token, `${api}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha })
  }).catch(async error => {
    if (!String(error.message).includes("422")) throw error;
    const current = await githubRequest(config.token, `${api}/git/ref/heads/${branch}`);
    return current;
  });

  const entries = [];
  for (const file of files) {
    const blob = await githubRequest(config.token, `${api}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content: Buffer.from(file.content, "utf8").toString("base64"), encoding: "base64" })
    });
    entries.push({ path: `android-projects/${projectId}/${file.path}`, mode: "100644", type: "blob", sha: blob.sha });
  }
  const tree = await githubRequest(config.token, `${api}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseSha, tree: entries })
  });
  const commit = await githubRequest(config.token, `${api}/git/commits`, {
    method: "POST",
    body: JSON.stringify({ message: `Add generated Android project ${projectId.slice(0, 8)}`, tree: tree.sha, parents: [baseSha] })
  });
  await githubRequest(config.token, `${api}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false })
  });
  const pull = await githubRequest(config.token, `${api}/pulls`, {
    method: "POST",
    body: JSON.stringify({
      title: `Build generated Android project ${projectId.slice(0, 8)}`,
      head: branch,
      base: baseBranch,
      body: "This pull request contains the user-approved generated Android project source. The Android APK workflow will validate and build this project in CI. Review the source before merging."
    })
  });
  return { repository: config.repository, branch, pullRequestUrl: pull.html_url, pullRequestNumber: pull.number, commitSha: commit.sha, filesSynced: entries.length };
}
