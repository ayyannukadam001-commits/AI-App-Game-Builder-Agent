import test from "node:test";
import assert from "node:assert/strict";
import { getGitHubSyncConfig } from "../server/github-sync.js";

test("GitHub sync is disabled without backend secrets", () => {
  assert.deepEqual(getGitHubSyncConfig({}), { configured: false, repository: "", token: "" });
});

test("GitHub sync reads repository and token only from server environment", () => {
  const config = getGitHubSyncConfig({ GITHUB_TOKEN: "server-secret", GITHUB_REPOSITORY: "owner/repo" });
  assert.equal(config.configured, true);
  assert.equal(config.repository, "owner/repo");
  assert.equal(config.token, "server-secret");
});

test("GitHub sync rejects missing repository configuration", () => {
  assert.equal(getGitHubSyncConfig({ GITHUB_TOKEN: "server-secret" }).configured, false);
});
