import test from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { listProjectFiles, readProjectFile, updateProjectFile, validateWorkspacePath } from "../server/project-files.js";

test("validates safe project-relative source paths", () => {
  assert.equal(validateWorkspacePath("src/App.jsx"), "src/App.jsx");
  assert.equal(validateWorkspacePath("app/src/main/MainActivity.kt"), "app/src/main/MainActivity.kt");
  assert.equal(validateWorkspacePath("app/build.gradle.kts"), "app/build.gradle.kts");
  assert.equal(validateWorkspacePath("app/src/main/AndroidManifest.xml"), "app/src/main/AndroidManifest.xml");
  assert.throws(() => validateWorkspacePath("../outside.js"), /Unsafe/);
  assert.throws(() => validateWorkspacePath(".env"), /Unsafe/);
  assert.throws(() => validateWorkspacePath("run.sh"), /file type/);
});

test("lists and reads supported workspace files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "builder-workspace-"));
  try {
    await mkdir(path.join(root, "src"));
    await writeFile(path.join(root, "src/App.jsx"), "export default 1;");
    await mkdir(path.join(root, "app/src/main"), { recursive: true });
    await writeFile(path.join(root, "app/src/main/MainActivity.kt"), "package demo");
    await writeFile(path.join(root, ".env"), "private");
    const files = await listProjectFiles(root);
    assert.deepEqual(files.map(file => file.path), ["app/src/main/MainActivity.kt", "src/App.jsx"]);
    const file = await readProjectFile(root, "src/App.jsx");
    assert.equal(file.content, "export default 1;");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("updates only an existing supported file", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "builder-workspace-"));
  try {
    await writeFile(path.join(root, "index.html"), "<h1>Before</h1>");
    const result = await updateProjectFile(root, "index.html", "<h1>After</h1>");
    assert.equal(result.saved, true);
    assert.equal(await readFile(path.join(root, "index.html"), "utf8"), "<h1>After</h1>");
    await assert.rejects(updateProjectFile(root, "new.html", "new"), /ENOENT/);
    await assert.rejects(updateProjectFile(root, "index.html", "x".repeat(180_001)), /180 KB/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
