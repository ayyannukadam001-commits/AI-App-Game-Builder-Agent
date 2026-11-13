import path from "node:path";
import { randomUUID } from "node:crypto";

const ALLOWED_EXTENSIONS = new Set([".html", ".css", ".js", ".jsx", ".ts", ".tsx", ".json", ".md", ".svg"]);
const BLOCKED_NAMES = new Set([".env", "package.json", "package-lock.json", "vite.config.js", "server.js"]);

export function validateGeneratedFiles(files) {
  if (!Array.isArray(files) || files.length < 1 || files.length > 20) {
    throw new Error("The model must return between 1 and 20 project files.");
  }
  const seen = new Set();
  let totalBytes = 0;
  return files.map((file) => {
    if (!file || typeof file.path !== "string" || typeof file.content !== "string") {
      throw new Error("Each generated file needs a path and text content.");
    }
    const normalized = file.path.replaceAll("\\", "/");
    if (!normalized || normalized.startsWith("/") || normalized.split("/").some(part => !part || part === "." || part === ".." || part.startsWith("."))) {
      throw new Error("Generated file paths must be safe relative paths without hidden or traversal segments.");
    }
    const parsed = path.posix.parse(normalized);
    if (BLOCKED_NAMES.has(parsed.base) || !ALLOWED_EXTENSIONS.has(parsed.ext.toLowerCase())) {
      throw new Error(`Generated file type or name is not allowed: ${normalized}`);
    }
    if (seen.has(normalized)) throw new Error(`Duplicate generated path: ${normalized}`);
    seen.add(normalized);
    const bytes = Buffer.byteLength(file.content, "utf8");
    totalBytes += bytes;
    if (bytes > 180_000 || totalBytes > 900_000) throw new Error("Generated project exceeds the allowed text size.");
    return { path: normalized, content: file.content };
  });
}

export function parseGeneratedProject(content) {
  if (typeof content !== "string") throw new Error("The AI returned no project content.");
  const cleaned = content.trim().replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "");
  let parsed;
  try { parsed = JSON.parse(cleaned); } catch { throw new Error("The AI response was not valid project JSON. Please retry with a coding-capable model."); }
  if (!parsed || typeof parsed.summary !== "string") throw new Error("The AI response is missing a project summary.");
  return { summary: parsed.summary.slice(0, 2000), files: validateGeneratedFiles(parsed.files) };
}

export function createProposal(project) {
  return { id: randomUUID(), ...project, createdAt: new Date().toISOString() };
}
