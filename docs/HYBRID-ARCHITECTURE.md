# Hybrid Architecture Plan

## Decision

The Builder uses a hybrid design: AI inference runs through an online model gateway, while generated project files, drafts, previews, and project metadata are managed in a device-side workspace. GitHub sync and cloud builds are optional and require explicit user approval.

## System layout

1. **Android client** — planned Capacitor shell around the existing React/Vite UI. It owns project navigation, local drafts/cache, diff review, previews, and artifact import. It must never contain provider API keys.
2. **Orchestrator backend** — Node.js service. It authenticates to FreeLLMAPI from server-side secrets, discovers currently available models, selects models by task capability, manages agent runs, and enforces tool permissions.
3. **Model gateway** — FreeLLMAPI using its OpenAI-compatible `/v1/models` and `/v1/chat/completions` interfaces. The gateway is an inference router, not the code workspace or Android compiler.
4. **Project workspace** — isolated per-project file tree. Agents propose patches; the user reviews a diff before changes are applied. Existing files are backed up/versioned.
5. **GitHub sync** — optional per-project repository connection. Sync/push is a separate approval step; credentials are stored only in a secure backend secret store.
6. **Build workers** — GitHub Actions runs Gradle/Android SDK builds for Android projects and uploads a real APK artifact. A successful web build is not an APK build.

## Model configuration

Model IDs must not be hardcoded because free endpoints and provider limits change. At runtime the backend should:

- fetch `/v1/models`;
- classify models only from reliable capability metadata or verified test probes;
- select a primary model for each agent task;
- keep a compatible backup candidate;
- test the selected model with a harmless short request before enabling it;
- report rate limits, authentication failures, unavailable providers, and empty responses clearly.

The JSON config defines task-specific environment overrides such as `AI_MODEL_FRONTEND`. Empty overrides mean automatic capability-based selection. Do not assume a model supports tool calls, JSON output, long context, vision, or code quality without verification.

## Agent pipeline

Manager → Planner → Architect → UI/UX → Frontend/Backend/Database/Game specialists → independent Reviewer → Tester/Debugger → Build/Release.

The first real code-writing milestone must include:
- bounded file tools (list/read/create/patch);
- path traversal protection and per-project isolation;
- patch/diff preview;
- explicit approval before writes, deletes, GitHub pushes, or builds;
- rollback to the previous project snapshot;
- automated tests and a build report tied to the exact source commit.

## Build targets

- **Builder APK:** React/Vite UI wrapped with Capacitor Android, then compiled with Android SDK + Gradle.
- **Generated Android apps:** Android SDK + Gradle Wrapper; debug APK first. Release signing only after the user configures signing secrets securely.
- **Web apps:** Vite production build.
- **Games:** Start with a separately verified 2D game pipeline (Godot is a candidate). Do not promise 3D exports until a real pipeline is tested.

## Free-use and security boundaries

- The app will not require a paid model provider by design, but free model quotas and uptime are controlled by providers and can change.
- No unlimited-free inference or always-on hosting is promised.
- GitHub Actions quotas and artifact retention depend on account/repository plan and usage.
- Never commit API keys, OAuth tokens, signing keys, or passwords.
- Do not expose the FreeLLMAPI unified key in the Android APK or browser bundle.
- Local mode must remain visibly unavailable until a local inference runtime is genuinely implemented and tested.

## Current status (honest)

The repository currently contains a React/Vite dashboard, a basic Node.js FreeLLMAPI adapter, and a planning-only 10-role sequence. It does **not** yet contain autonomous file editing, a Capacitor Android project, Gradle build configuration, or a verified APK pipeline. This document and the config are architecture preparation, not a claim that those features are already implemented.
