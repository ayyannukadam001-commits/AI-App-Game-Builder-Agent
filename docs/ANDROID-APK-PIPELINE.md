# Android APK build pipeline

## First verified milestone

The repository includes a minimal native Kotlin/Jetpack Compose app at `android-projects/sample` and a dedicated GitHub Actions workflow at `.github/workflows/android-apk.yml`.

The workflow:
1. Installs JDK 17 and Android SDK components.
2. Uses Gradle 8.9 with Android Gradle Plugin 8.7.3.
3. Runs `:app:assembleDebug`.
4. Fails unless the generated APK exists and is non-empty.
5. Uploads `app-debug.apk` as the `sample-android-debug-apk` artifact for 14 days.

Run it manually from GitHub Actions → Android APK Build → Run workflow. It also runs for pull requests and pushes that change the sample Android project or this workflow.

## Honest capability boundary

This first milestone proves that the repository can produce a real Android debug APK. It does **not** yet convert arbitrary AI-generated web files into native Android apps, build user projects from the server workspace, export games, or create a signed release APK.

## Next implementation milestones

- Add a dedicated Android project generator that produces a validated Gradle project rather than generic web starter files.
- Add an explicit user-approved project publish/build flow. Never execute AI-generated shell scripts or arbitrary Gradle tasks.
- Add build-job status, useful logs and artifact retrieval in the dashboard.
- Add device/emulator smoke testing and a separate release-signing flow only when the user configures signing credentials.


## Native Android project proposal API

The backend exposes `POST /api/projects/generate-android` with JSON fields `idea`, optional `mode` (`api` or `local`), and optional `model`. It asks the configured AI provider for a Kotlin/Jetpack Compose Gradle project and validates the required Gradle files, launcher manifest, namespace, and Compose activity before returning a preview proposal.

The endpoint does not execute generated Gradle files. The client must show the returned file previews and obtain explicit user approval before calling the existing `POST /api/projects/:proposalId/apply` endpoint. Applied Android source and Gradle files can be listed, read, and edited through the existing workspace file APIs.

**Build boundary:** proposals are not APKs. This endpoint does not start a build or claim that the generated project compiles. A later build-worker milestone must compile a selected approved workspace project in an isolated CI job and verify its APK artifact.
\n\n## Security boundary for generated projects\n\nThe manual workflow is an explicit build trigger, not a hardened arbitrary-code sandbox. Gradle project configuration and plugins can execute code during a build. The worker therefore runs on a fresh GitHub-hosted runner, has only read-only repository permissions, disables persisted checkout credentials, receives no application API keys or signing secrets, and is not automatically triggered for arbitrary generated project folders. Only build projects whose source you trust. A stronger isolated execution service with network controls and per-project resource quotas remains a separate security milestone.\n\n## Current workspace integration limitation\n\nAI-generated Android projects are currently saved in the Builder backend's local workspace. They are not automatically copied into the GitHub repository. Until project-specific GitHub sync is implemented, a generated project must be reviewed and committed under `android-projects/<project-name>/` before the manual worker can build it. The worker does not claim to compile a project that remains only in the server-local workspace.\n