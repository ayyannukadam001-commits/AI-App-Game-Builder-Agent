# Generated Android project GitHub sync

After reviewing and applying a native Android proposal in the workspace, the user can explicitly choose **Sync to GitHub & build APK**.

## Backend configuration

Set these environment variables on the backend deployment (not in the browser, APK, or repository):

- `GITHUB_TOKEN`: fine-grained token restricted to this repository, with **Contents: Read and write** and **Pull requests: Read and write**.
- `GITHUB_REPOSITORY`: repository in `owner/name` format.

The token is read only by the server. The status endpoint returns only whether configuration exists and the repository name; it never returns the token.

## Flow

1. User reviews generated source and approves saving it to the workspace.
2. User explicitly starts GitHub sync.
3. Server validates the complete Android project, creates a unique branch, writes files under `android-projects/<project-id>/`, and opens a pull request.
4. The Android APK workflow runs on pull requests touching `android-projects/**`, validates the project, builds `:app:assembleDebug`, verifies the APK archive/package, and uploads the artifact.
5. User reviews and merges the source PR only when satisfied. The sync endpoint never pushes to `main` or merges a PR.

## Important limitations

- This prototype has no per-user login/authorization layer. Deploy it only behind trusted access controls; do not expose a shared workspace server publicly.
- The GitHub token has repository write capability. Use a narrowly scoped fine-grained token and rotate it if exposed.
- The CI worker executes Gradle build scripts from the pull request. Only sync and build source you trust; this is not a hardened network-isolated sandbox.
- The APK is a debug build. A release-signed APK requires a separate, secure signing setup.
