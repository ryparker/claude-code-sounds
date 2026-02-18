---
name: release
description: Bump version, commit, push, and create a GitHub Release that auto-publishes to npm
argument-hint: <patch|minor|major>
---

# Release to npm

Automate the full release flow for claude-code-sounds.

**Bump type:** $ARGUMENTS (default: `patch`)

## Steps

1. **Determine version bump** — Parse the argument as `patch`, `minor`, or `major`. Default to `patch` if not specified.

2. **Check preconditions:**
   - Working tree is clean (`git status --porcelain` is empty)
   - On the `main` branch
   - Up to date with remote (`git pull`)

3. **Bump version** in `package.json` using the bump type:
   - Read current version
   - Calculate new version (e.g., 1.1.1 → 1.1.2 for patch)
   - Edit package.json with the new version

4. **Run validation** before committing:
   ```bash
   node --check bin/cli.js
   node bin/cli.js --list
   shellcheck -S warning hooks/*.sh install.sh preview.sh themes/*/download.sh
   ```

5. **Commit and push:**
   ```bash
   git add package.json
   git commit -m "Bump version to X.Y.Z"
   git push origin main
   ```

6. **Create GitHub Release** with tag `vX.Y.Z`:
   ```bash
   gh release create vX.Y.Z --title "vX.Y.Z" --generate-notes
   ```
   Use `--generate-notes` to auto-generate release notes from commits since the last release.

7. **Verify** the publish workflow started:
   ```bash
   gh run list --workflow publish.yml --limit 1
   ```

8. **Report** the release URL and remind the user to check the Actions tab for publish status.
