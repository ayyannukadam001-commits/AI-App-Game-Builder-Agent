import test from "node:test";
import assert from "node:assert/strict";
import { parseGeneratedProject, validateGeneratedFiles } from "../server/workspace.js";

test("accepts safe relative source files", () => {
  const files = validateGeneratedFiles([{ path: "src/App.jsx", content: "export default function App() {}" }]);
  assert.equal(files.length, 1);
});

test("rejects traversal paths", () => {
  assert.throws(() => validateGeneratedFiles([{ path: "../secret.js", content: "x" }]), /safe relative paths/);
});

test("rejects hidden files and environment files", () => {
  assert.throws(() => validateGeneratedFiles([{ path: ".env", content: "secret" }]));
  assert.throws(() => validateGeneratedFiles([{ path: "src/.hidden.js", content: "x" }]));
});

test("rejects duplicate paths and excessive file counts", () => {
  assert.throws(() => validateGeneratedFiles([{ path: "a.js", content: "1" }, { path: "a.js", content: "2" }]), /Duplicate/);
  assert.throws(() => validateGeneratedFiles(Array.from({ length: 21 }, (_, i) => ({ path: `f${i}.js`, content: "" }))));
});

test("parses the proposed project JSON", () => {
  const project = parseGeneratedProject(JSON.stringify({ summary: "A small app", files: [{ path: "index.html", content: "<h1>Hello</h1>" }] }));
  assert.equal(project.summary, "A small app");
  assert.equal(project.files[0].path, "index.html");
});
