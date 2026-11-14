import path from "node:path";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";

const ALLOWED_EXTENSIONS = new Set([".html", ".css", ".js", ".jsx", ".ts", ".tsx", ".json", ".md", ".svg"]);
const MAX_FILE_BYTES = 180_000;

export function validateWorkspacePath(relativePath) {
  if (typeof relativePath !== "string" || !relativePath.trim()) {
    throw new Error("A project-relative file path is required.");
  }
  const normalized = relativePath.replaceAll("\\", "/");
  const parts = normalized.split("/");
  if (normalized.startsWith("/") || parts.some(part => !part || part === "." || part === ".." || part.startsWith("."))) {
    throw new Error("Unsafe project file path.");
  }
  const extension = path.posix.extname(normalized).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(extension)) throw new Error("This project file type is not editable in the workspace.");
  return normalized;
}

function resolveProjectFile(projectDir, relativePath) {
  const safePath = validateWorkspacePath(relativePath);
  const root = path.resolve(projectDir);
  const target = path.resolve(root, safePath);
  if (!target.startsWith(root + path.sep)) throw new Error("Unsafe project file path.");
  return { target, safePath };
}

export async function listProjectFiles(projectDir) {
  const root = path.resolve(projectDir);
  const results = [];
  async function walk(directory, prefix = "") {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const relative = prefix ? prefix + "/" + entry.name : entry.name;
      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".")) await walk(path.join(directory, entry.name), relative);
      } else if (entry.isFile()) {
        try {
          const safePath = validateWorkspacePath(relative);
          const info = await stat(path.join(root, safePath));
          results.push({ path: safePath, size: info.size, editable: info.size <= MAX_FILE_BYTES });
        } catch {
          // Ignore unsupported or unsafe files rather than exposing them.
        }
      }
    }
  }
  await walk(root);
  return results.sort((a, b) => a.path.localeCompare(b.path));
}

export async function readProjectFile(projectDir, relativePath) {
  const { target, safePath } = resolveProjectFile(projectDir, relativePath);
  const info = await stat(target);
  if (!info.isFile() || info.size > MAX_FILE_BYTES) throw new Error("File is missing or exceeds the workspace size limit.");
  return { path: safePath, content: await readFile(target, "utf8"), size: info.size };
}

export async function updateProjectFile(projectDir, relativePath, content) {
  if (typeof content !== "string") throw new Error("File content must be text.");
  const bytes = Buffer.byteLength(content, "utf8");
  if (bytes > MAX_FILE_BYTES) throw new Error("File exceeds the 180 KB workspace limit.");
  const { target, safePath } = resolveProjectFile(projectDir, relativePath);
  const info = await stat(target);
  if (!info.isFile()) throw new Error("Only existing project files can be edited.");
  await writeFile(target, content, { encoding: "utf8" });
  return { path: safePath, size: bytes, saved: true };
}
