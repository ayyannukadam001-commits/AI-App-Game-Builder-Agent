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
