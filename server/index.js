import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const port = Number(process.env.PORT || 8787);
const baseUrl = (process.env.FREELLMAPI_BASE_URL || "").replace(/\/+$/, "");
const apiKey = process.env.FREELLMAPI_API_KEY || "";
const configuredModel = process.env.FREELLMAPI_MODEL || "";
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json({ limit: "1mb" }));

function gatewayHeaders() {
  return { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" };
}
async function gateway(pathname, options = {}) {
  if (!baseUrl || !apiKey) throw new Error("FreeLLMAPI is not configured. Set FREELLMAPI_BASE_URL and FREELLMAPI_API_KEY on the server.");
  const response = await fetch(`${baseUrl}${pathname}`, {
    ...options,
    headers: { ...gatewayHeaders(), ...(options.headers || {}) },
    signal: AbortSignal.timeout(90000)
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { error: raw.slice(0, 500) }; }
  if (!response.ok) throw new Error(data?.error?.message || data?.message || `FreeLLMAPI returned HTTP ${response.status}`);
  return data;
}

app.get("/api/health", (_req, res) => res.json({
  status: "ok",
  gatewayConfigured: Boolean(baseUrl && apiKey),
  localModeAvailable: false,
  apkBuilderAvailable: false
}));

app.get("/api/models", async (_req, res) => {
  try {
    const data = await gateway("/v1/models");
    const models = Array.isArray(data.data) ? data.data.map(item => ({ id: item.id, name: item.id })) : [];
    res.json({ models, defaultModel: configuredModel || models[0]?.id || null });
  } catch (error) {
    res.status(503).json({ error: error.message, models: [] });
  }
});

app.post("/api/agents/plan", async (req, res) => {
  const { idea, kind = "app", mode = "api", model } = req.body || {};
  if (typeof idea !== "string" || idea.trim().length < 8 || idea.length > 12000) {
    return res.status(400).json({ error: "Please enter a project idea between 8 and 12,000 characters." });
  }
  if (mode !== "api") return res.status(400).json({ error: "Local/offline inference is not implemented yet. Choose API / Cloud mode." });
  const selectedModel = model || configuredModel;
  if (!selectedModel) return res.status(400).json({ error: "No model selected. Configure FreeLLMAPI and load its model list." });

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
      const result = await gateway("/v1/chat/completions", {
        method: "POST",
        body: JSON.stringify({ model: selectedModel, messages, temperature: 0.3, max_tokens: 900 })
      });
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