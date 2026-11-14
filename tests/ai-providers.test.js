import test from "node:test";
import assert from "node:assert/strict";
import { createChatCompletion, getProviderConfig, listProviderModels } from "../server/ai-providers.js";

function response(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(data) };
}

test("local provider defaults to Ollama and does not require an API key", () => {
  const config = getProviderConfig("local", {});
  assert.equal(config.baseUrl, "http://127.0.0.1:11434");
  assert.equal(config.apiKey, "");
});

test("cloud provider requires an explicit base URL and server-side key", async () => {
  await assert.rejects(() => listProviderModels("cloud", { env: {}, fetchImpl: async () => response({ data: [] }) }), /FREELLMAPI_BASE_URL/);
  await assert.rejects(() => listProviderModels("cloud", { env: { FREELLMAPI_BASE_URL: "https://gateway.example" }, fetchImpl: async () => response({ data: [] }) }), /FREELLMAPI_API_KEY/);
});

test("local model discovery maps Ollama tags", async () => {
  let requestedUrl = "";
  const result = await listProviderModels("local", {
    env: { LOCAL_AI_BASE_URL: "http://localhost:11434" },
    fetchImpl: async url => { requestedUrl = url; return response({ models: [{ name: "qwen2.5-coder:1.5b" }, { model: "llama3.2:1b" }] }); }
  });
  assert.equal(requestedUrl, "http://localhost:11434/api/tags");
  assert.deepEqual(result.models.map(item => item.id), ["qwen2.5-coder:1.5b", "llama3.2:1b"]);
  assert.equal(result.defaultModel, "qwen2.5-coder:1.5b");
});

test("local chat uses the OpenAI-compatible endpoint without Authorization", async () => {
  let captured;
  const result = await createChatCompletion({
    provider: "local", model: "qwen2.5-coder:1.5b",
    messages: [{ role: "user", content: "hello" }]
  }, {
    env: { LOCAL_AI_BASE_URL: "http://localhost:11434" },
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return response({ choices: [{ message: { content: "hello back" } }] });
    }
  });
  assert.equal(captured.url, "http://localhost:11434/v1/chat/completions");
  assert.equal(captured.options.headers.Authorization, undefined);
  assert.equal(result.choices[0].message.content, "hello back");
});

test("provider errors are reported without hiding HTTP status", async () => {
  await assert.rejects(() => createChatCompletion({
    provider: "local", model: "missing", messages: []
  }, {
    env: { LOCAL_AI_BASE_URL: "http://localhost:11434" },
    fetchImpl: async () => response({ error: "model not found" }, 404)
  }), /Local AI returned HTTP 404/);
});
