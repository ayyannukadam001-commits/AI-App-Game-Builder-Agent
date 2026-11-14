import test from "node:test";
import assert from "node:assert/strict";
import { parseGeneratedProject, validateAndroidProjectFiles, validateGeneratedFiles } from "../server/workspace.js";

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


test("accepts a complete validated native Android Compose project", () => {
  const files = [
    { path: "settings.gradle.kts", content: "pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }" },
    { path: "build.gradle.kts", content: 'plugins { id("com.android.application") version "8.7.3" apply false; id("org.jetbrains.kotlin.android") version "2.0.21" apply false }' },
    { path: "gradle.properties", content: "android.useAndroidX=true" },
    { path: "app/build.gradle.kts", content: 'plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }; android { namespace = "com.builderagent.generated"; compileSdk = 35 }' },
    { path: "app/src/main/AndroidManifest.xml", content: '<manifest><application><activity android:name=".MainActivity" android:exported="true"><intent-filter><action android:name="android.intent.action.MAIN"/><category android:name="android.intent.category.LAUNCHER"/></intent-filter></activity></application></manifest>' },
    { path: "app/src/main/java/com/builderagent/generated/MainActivity.kt", content: "package com.builderagent.generated\\nclass MainActivity { fun setContent() {} }" }
  ];
  assert.equal(validateAndroidProjectFiles(files).length, 6);
});

test("rejects Android projects missing required build files", () => {
  assert.throws(() => validateAndroidProjectFiles([{ path: "MainActivity.kt", content: "package x" }]), /missing required/);
});

test("rejects unsafe Android project scripts", () => {
  const files = [
    { path: "settings.gradle.kts", content: "x" },
    { path: "build.gradle.kts", content: "x" },
    { path: "gradle.properties", content: "x" },
    { path: "app/build.gradle.kts", content: "x" },
    { path: "app/src/main/AndroidManifest.xml", content: "x" },
    { path: "app/src/main/java/com/builderagent/generated/MainActivity.kt", content: "x" },
    { path: "build.sh", content: "rm -rf ." }
  ];
  assert.throws(() => validateAndroidProjectFiles(files), /not allowed/);
});
