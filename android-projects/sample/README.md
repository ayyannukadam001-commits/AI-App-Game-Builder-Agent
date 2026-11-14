# Sample Android project

This is a small native Android app used to verify the repository's Gradle-to-APK pipeline.

- Language: Kotlin
- UI: Jetpack Compose + Material 3
- Minimum Android version: API 23
- Build task: `gradle :app:assembleDebug`
- Output: `app/build/outputs/apk/debug/app-debug.apk`

The resulting APK is a **debug APK** for testing. It is not a Play Store-ready signed release.

This sample validates the Android toolchain only. The AI-generated project-to-APK workflow (project-specific Android code generation, safe source publishing, build status and artifact retrieval in the dashboard) is a separate next milestone.
