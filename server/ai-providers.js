const DEFAULT_LOCAL_BASE_URL = "http://127.0.0.1:11434";

function cleanBaseUrl(value) {
  return String(value || "").trim().replace(/\\/+$/, "");
}

export function getProviderConfig(provider, env = process.env) {
  if (provider === "local") {
    return {
      id: "local",
      baseUrl: cleanBaseUrl(env.LOCAL_AI_BASE_URL || DEFAULT_LOCAL_BASE_URL),
      apiKey: env.LOCAL_AI_API_KEY || "",
      defaultModel: env.LOCAL_AI_MODEL || ""
    };
  }
  if (provider !== "cloud") throw new Error("Unknown AI provider. Choose cloud or local.");
  return {
    id: "cloud",
    baseUrl: cleanBaseUrl(env.FREELLMAPI_BASE_URL),
    apiKey: env.FREELLMAPI_API_KEY || "",
    defaultModel: env.FREELLMAPI_MODEL || ""
  };
}

function headersFor(config) {
  const headers = { "Content-Type": "application/json" };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;
  return headers;
}

async function readJson(response, provider) {
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; }
  catch { data = { error: raw.slice(0, 400) }; }
  if (!response.ok) {
    const detail = data?.error?.message || data?.error || data?.message;
    throw new Error(`${provider === "local" ? "Local AI" : "Cloud AI"} returned HTTP ${response.status}${detail ? `: ${String(detail).slice(0, 300)}` : ""}`);
  }
  return data;
}

export async function listProviderModels(provider, options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || fetch;
  const config = getProviderConfig(provider, env);
  if (!config.baseUrl) throw new Error(provider === "local"
    ? "Local AI is not configured. Set LOCAL_AI_BASE_URL to a reachable Ollama-compatible server."
    : "Cloud AI is not configured. Set FREELLMAPI_BASE_URL and FREELLMAPI_API_KEY on the server.");
  if (provider === "cloud" && !config.apiKey) {
    throw new Error("Cloud AI needs FREELLMAPI_API_KEY on the server. No key is required for a local Ollama server.");
  }

  const url = provider === "local" ? `${config.baseUrl}/api/tags` : `${config.baseUrl}/v1/models`;
  const response = await fetchImpl(url, {
    headers: headersFor(config),
    signal: AbortSignal.timeout(15000)
  });
  const data = await readJson(response, provider);
  const source = provider === "local" ? data.models : data.data;
  const models = Array.isArray(source) ? source.map(item => {
    const id = provider === "local" ? (item.name || item.model) : item.id;
    return id ? { id, name: id, provider } : null;
  }).filter(Boolean) : [];
  return { models, defaultModel: config.defaultModel || models[0]?.id || null, provider };
}

export async function createChatCompletion(request, options = {}) {
  const provider = request.provider === "local" ? "local" : "cloud";
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || fetch;
  const config = getProviderConfig(provider, env);
  if (!config.baseUrl) throw new Error(provider === "local"
    ? "Local AI is not configured. Set LOCAL_AI_BASE_URL to a reachable Ollama-compatible server."
    : "Cloud AI is not configured. Set FREELLMAPI_BASE_URL and FREELLMAPI_API_KEY on the server.");
  if (provider === "cloud" && !config.apiKey) {
    throw new Error("Cloud AI needs FREELLMAPI_API_KEY on the server.");
  }
  if (!request.model || typeof request.model !== "string") throw new Error("Select an available model first.");
  const response = await fetchImpl(`${config.baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: headersFor(config),
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.2,
      max_tokens: request.maxTokens ?? 1600
    }),
    signal: AbortSignal.timeout(request.timeoutMs || 90000)
  });
  return readJson(response, provider);
}
