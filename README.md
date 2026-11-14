# AI App & Game Builder Agent

A mobile-first AI app/game creation workspace. This repository is the source of truth; no Floot dependency.

## Chosen architecture

**Hybrid:** online AI inference through FreeLLMAPI, device-side project workspace/cache, optional GitHub project sync, and GitHub Actions build workers.

See:
- [Hybrid architecture](docs/HYBRID-ARCHITECTURE.md)
- [Machine-readable architecture config](config/hybrid-architecture.json)

## Current repository status

- React + Vite responsive dashboard.
- Node.js/Express backend with a provider adapter for cloud FreeLLMAPI and optional Ollama-compatible local inference. Cloud model discovery uses `/v1/models`; local model discovery uses `/api/tags`.
- Ten sequential planning roles.
- Server-side API key handling.
- GitHub Actions currently validates JavaScript and builds the web workspace.

## Not implemented yet

- Task-specific automatic model routing and verified provider fallback.
- Autonomous multi-step code editing, execution sandbox, diff approvals, and rollback. The current editor saves user-approved text changes but does not execute generated code.
- Capacitor Android wrapper for the Builder APK.
- Android SDK/Gradle APK build pipeline and verified APK artifacts.
- Local project database/cache and per-project GitHub sync.
- Verified game export pipeline.

A passing web build is not an Android APK build. The repository will only report an APK as ready when the APK file exists, is non-empty, and is uploaded as a workflow artifact.

## AI connection

FreeLLMAPI must run somewhere reachable by the backend. Configure `FREELLMAPI_BASE_URL` and `FREELLMAPI_API_KEY` as backend environment secrets. Never add real keys to source files, the APK, or Git history.

Model IDs are discovered dynamically from the selected provider. Optional task-specific model overrides are documented in `config/hybrid-architecture.json`; free-tier availability and quotas must be checked at runtime.

## Free-use policy

No paid provider is mandatory by design. However, free inference, hosting, and CI have provider-specific limits; unlimited free usage is not guaranteed.
