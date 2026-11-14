import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createProposal, parseGeneratedProject, validateAndroidProjectFiles } from "./workspace.js";
import { listProjectFiles, readProjectFile, updateProjectFile } from "./project-files.js";
import { createChatCompletion, getProviderConfig, listProviderModels } from "./ai-providers.js";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT || 8787);
const configuredModel = process.env.FREELLMAPI_MODEL || "";
const pendingProposals = new Map();
const workspaceRoot = path.resolve(process.env.WORKSPACE_DIR || "./data/workspaces");
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: "1mb" }));


app.post("/api/projects/generate-android", async (req, res) => {
  const { idea, model, mode = "api" } = req.body || {};
  if (typeof idea !== "string" || idea.trim().length < 8 || idea.length > 8000) {
    return res.status(400).json({ error: "Enter an Android app idea between 8 and 8,000 characters." });
  }
  const provider = mode === "local" ? "local" : "cloud";
  const providerConfig = getProviderConfig(provider);
  const selectedModel = model || providerConfig.defaultModel || (provider === "cloud" ? configuredModel : "");
  if (!selectedModel) return res.status(400).json({ error: "No model selected. Connect the chosen AI provider and load its model list." });
  try {
    const result = await createChatCompletion({
      provider, model: selectedModel, temperature: 0.15, maxTokens: 9000,
      messages: [
        { role: "system", content: "You generate native Android projects using Kotlin, Jetpack Compose and Gradle Kotlin DSL. Return ONLY valid JSON with exactly this shape: {\\"summary\\":string,\\"files\\":[{\\"path\\":string,\\"content\\":string}]}. Include all six required paths: settings.gradle.kts, build.gradle.kts, gradle.properties, app/build.gradle.kts, app/src/main/AndroidManifest.xml, and app/src/main/java/com/builderagent/generated/MainActivity.kt. Root plugins must use Android Gradle Plugin 8.7.3 and Kotlin 2.0.21 (including the Compose compiler plugin). Use compileSdk 35, minSdk 23, targetSdk 35, Java 17, Compose BOM 2024.09.00, activity-compose and Material3. Namespace and applicationId must be com.builderagent.generated. MainActivity must be a working Compose Activity with setContent. Manifest must declare the launcher activity and exported=true. Use only safe relative text source/config paths. Do not include wrapper binaries, shell scripts, package managers, CI workflows, environment files, credentials, arbitrary build tasks, or secrets. Maximum 12 files. Do not claim this was built or tested. No Markdown fences." },
        { role: "user", content: "Create a complete minimal native Android app project for this idea:\\n" + idea + "\\n\\nReturn full contents for the six required files and only additional Kotlin/XML/Gradle configuration files that are genuinely needed. Keep it buildable with the repository's Android SDK and Gradle workflow." }
      ]
    });
    const content = result?.choices?.[0]?.message?.content;
    const project = parseGeneratedProject(typeof content === "string" ? content : "");
    project.files = validateAndroidProjectFiles(project.files);
    const proposal = createProposal({ ...project, projectType: "android-native" });
    pendingProposals.set(proposal.id, proposal);
    res.json({
      proposalId: proposal.id,
      projectType: proposal.projectType,
      summary: proposal.summary,
      files: proposal.files.map(file => ({ path: file.path, preview: file.content.slice(0, 5000), truncated: file.content.length > 5000 })),
      approvalRequired: true,
      buildStatus: "not-built",
      expiresInMinutes: 30
    });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.post("/api/projects/generate", async (req, res) => {
  const { idea, kind = "app", model, mode = "api" } = req.body || {};
  if (typeof idea !== "string" || idea.trim().length < 8 || idea.length > 8000) {
    return res.status(400).json({ error: "Enter a project idea between 8 and 8,000 characters." });
  }
  const provider = mode === "local" ? "local" : "cloud";
  const providerConfig = getProviderConfig(provider);
  const selectedModel = model || providerConfig.defaultModel || (provider === "cloud" ? configuredModel : "");
  if (!selectedModel) return res.status(400).json({ error: "No model selected. Connect the chosen AI provider and load its model list." });
  try {
    const result = await createChatCompletion({
      provider, model: selectedModel, temperature: 0.2, maxTokens: 7000,
      messages: [
          { role: "system", content: `You are a careful software project generator. Return ONLY valid JSON with exactly this shape: {"summary":string,"files":[{"path":string,"content":string}]}. Generate a small coherent starter project, not a plan. Use only relative paths and text source files. Do not include package.json, environment files, scripts, CI workflows, or secrets. Maximum 20 files. Never claim the project was built or tested. Do not wrap JSON in Markdown fences.` },
          { role: "user", content: `Create a ${kind === "game" ? "game" : "app"} starter project for this idea:\\n${idea}\\n\\nInclude a concise summary and complete contents for every file. Use a simple web preview-compatible starter unless the request explicitly requires a different framework.` }
      ]
    });
    const content = result?.choices?.[0]?.message?.content;
    const project = parseGeneratedProject(typeof content === "string" ? content : "");
    const proposal = createProposal(project);
    pendingProposals.set(proposal.id, proposal);
    res.json({
      proposalId: proposal.id,
      summary: proposal.summary,
      files: proposal.files.map(file => ({ path: file.path, preview: file.content.slice(0, 5000), truncated: file.content.length > 5000 })),
      approvalRequired: true,
      expiresInMinutes: 30
    });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.post("/api/projects/:proposalId/apply", async (req, res) => {
  const proposal = pendingProposals.get(req.params.proposalId);
  if (!proposal) return res.status(404).json({ error: "Proposal not found or expired. Generate it again." });
  try {
    const projectId = randomUUID();
    const projectDir = path.resolve(workspaceRoot, projectId);
    await mkdir(projectDir, { recursive: true });
    for (const file of proposal.files) {
      const destination = path.resolve(projectDir, file.path);
      if (!destination.startsWith(projectDir + path.sep)) throw new Error("Unsafe destination path.");
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, file.content, { encoding: "utf8", flag: "wx" });
    }
    pendingProposals.delete(proposal.id);
    res.status(201).json({
      projectId,
      summary: proposal.summary,
      files: proposal.files.map(file => file.path),
      workspace: "server-local",
      note: "Files were written to an isolated workspace. They have not been executed, tested, synced to GitHub, or built into an APK."
    });
  } catch (error) {
    res.status(500).json({ error: "Could not apply the approved project proposal.", detail: error.message });
  }
});


app.get("/api/projects/:projectId/files", async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.projectId)) return res.status(400).json({ error: "Invalid project ID." });
  try {
    const projectDir = path.resolve(workspaceRoot, req.params.projectId);
    const files = await listProjectFiles(projectDir);
    res.json({ projectId: req.params.projectId, files });
  } catch (error) {
    res.status(404).json({ error: "Project workspace not found.", detail: error.message });
  }
});

app.get("/api/projects/:projectId/file", async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.projectId)) return res.status(400).json({ error: "Invalid project ID." });
  try {
    const projectDir = path.resolve(workspaceRoot, req.params.projectId);
    res.json(await readProjectFile(projectDir, req.query.path));
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

app.put("/api/projects/:projectId/file", async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.projectId)) return res.status(400).json({ error: "Invalid project ID." });
  try {
    const projectDir = path.resolve(workspaceRoot, req.params.projectId);
    const result = await updateProjectFile(projectDir, req.body?.path, req.body?.content);
    res.json(result);
  } catch (error) {
    const status = error.code === "ENOENT" ? 404 : 400;
    res.status(status).json({ error: error.message });
  }
});

app.get("/api/health", (_req, res) => res.json({
  status: "ok",
  cloudConfigured: Boolean(process.env.FREELLMAPI_BASE_URL && process.env.FREELLMAPI_API_KEY),
  localConfigured: Boolean(process.env.LOCAL_AI_BASE_URL),
  localDefaultBaseUrl: process.env.LOCAL_AI_BASE_URL || "http://127.0.0.1:11434",
  localModeAvailable: true,
  apkBuilderAvailable: false
}));

app.get("/api/models", async (req, res) => {
  const provider = req.query.provider === "local" ? "local" : "cloud";
  try {
    const result = await listProviderModels(provider);
    res.json(result);
  } catch (error) {
    res.status(503).json({ error: error.message, models: [], provider });
  }
});

app.post("/api/agents/plan", async (req, res) => {
  const { idea, kind = "app", mode = "api", model } = req.body || {};
  if (typeof idea !== "string" || idea.trim().length < 8 || idea.length > 12000) {
    return res.status(400).json({ error: "Please enter a project idea between 8 and 12,000 characters." });
  }
  const provider = mode === "local" ? "local" : "cloud";
  const providerConfig = getProviderConfig(provider);
  const selectedModel = model || providerConfig.defaultModel || (provider === "cloud" ? configuredModel : "");
  if (!selectedModel) return res.status(400).json({ error: "No model selected. Connect the chosen AI provider and load its model list." });

  const roles = [
    ["Manager / Coordinator", "Synthesize a concise project brief, goals, assumptions and open questions."],
    ["Planner", "Create phased milestones and acceptance criteria."],
    ["App & Game Architect", "Recommend a feasible platform, architecture, core modules and technical risks."],
    ["UI/UX Designer", "Describe key screens, navigation, responsive behavior and accessibility."],
    ["Frontend Developer", "Propose frontend structure, components and state flow."],
    ["Backend Developer", "Propose API routes, integrations, security and background jobs."],
    ["Database Specialist", "Propose entities, relationships, persistence and privacy considerations."],
    ["Game Developer", "If this is a game, propose gameplay loop, systems, physics scope and performance plan; otherwise state not applicable."],
    ["Tester & Debugger", "Create a prioritized test matrix, edge cases and debugging strategy."],
    ["Build & Release Agent", "Explain realistic build targets, prerequisites, CI steps and artifact verification. Never claim a build happened."]
  ];
  const completed = [];
  const outputs = [];
  try {
    for (const [role, instruction] of roles) {
      const messages = [
        { role: "system", content: "You are one specialist in a coordinated software-building agent team. Be technically honest, concise but useful. Do not claim code was written, tests passed, services connected, or binaries built unless the tools actually did that. Clearly label assumptions, risks, free-tier limits and unavailable capabilities. Prefer beginner-friendly implementation steps." },
        { role: "user", content: `Project type: ${kind}\nProject idea: ${idea}\n\nYour role: ${role}\nTask: ${instruction}\n\nReturn your specialist findings in clear Markdown. Avoid repeating prior sections; shared context from earlier agents follows.\n\nPrior agent findings:\n${outputs.join("\n\n").slice(-14000)}` }
      ];
      const result = await createChatCompletion({ provider, model: selectedModel, messages, temperature: 0.3, maxTokens: 900 });
      const answer = result?.choices?.[0]?.message?.content;
      if (!answer) throw new Error(`${role} returned an empty response.`);
      outputs.push(`## ${role}\n\n${typeof answer === "string" ? answer : JSON.stringify(answer)}`);
      completed.push(role);
    }
    res.json({ plan: outputs.join("\n\n---\n\n"), completed, model: selectedModel });
  } catch (error) {
    res.status(502).json({ error: error.message, completed, partialPlan: outputs.join("\n\n---\n\n") });
  }
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, "../dist");
app.use(express.static(distPath));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(distPath, "index.html"), error => { if (error) next(); });
});
app.listen(port, () => console.log(`Builder Agent server listening on :${port}`));