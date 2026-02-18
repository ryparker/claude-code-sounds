#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

// ─── Paths ───────────────────────────────────────────────────────────────────

const PKG_DIR = path.resolve(__dirname, "..");
const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const SOUNDS_DIR = path.join(CLAUDE_DIR, "sounds");
const HOOKS_DIR = path.join(CLAUDE_DIR, "hooks");
const SETTINGS_PATH = path.join(CLAUDE_DIR, "settings.json");
const THEMES_DIR = path.join(PKG_DIR, "themes");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function print(msg = "") {
  console.log(msg);
}

function die(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function exec(cmd, opts = {}) {
  return execSync(cmd, { encoding: "utf-8", stdio: "pipe", ...opts });
}

function listThemes() {
  const themes = [];
  for (const name of fs.readdirSync(THEMES_DIR)) {
    const themeJson = path.join(THEMES_DIR, name, "theme.json");
    if (!fs.existsSync(themeJson)) continue;
    const meta = JSON.parse(fs.readFileSync(themeJson, "utf-8"));
    themes.push({ name, description: meta.description || "", display: meta.name || name });
  }
  return themes;
}

function readSettings() {
  if (fs.existsSync(SETTINGS_PATH)) {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
  }
  return {};
}

function writeSettings(settings) {
  mkdirp(CLAUDE_DIR);
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n");
}

// ─── Hooks Config ────────────────────────────────────────────────────────────

const HOOKS_CONFIG = {
  SessionStart: [{ matcher: "startup", hooks: [{ type: "command", command: '/bin/bash "$HOME/.claude/hooks/play-sound.sh" start', timeout: 5 }] }],
  SessionEnd: [{ hooks: [{ type: "command", command: '/bin/bash "$HOME/.claude/hooks/play-sound.sh" end', timeout: 5 }] }],
  Notification: [
    { matcher: "permission_prompt", hooks: [{ type: "command", command: '/bin/bash "$HOME/.claude/hooks/play-sound.sh" permission', timeout: 5 }] },
    { matcher: "idle_prompt", hooks: [{ type: "command", command: '/bin/bash "$HOME/.claude/hooks/play-sound.sh" idle', timeout: 5 }] },
  ],
  Stop: [{ hooks: [{ type: "command", command: '/bin/bash "$HOME/.claude/hooks/play-sound.sh" stop', timeout: 5 }] }],
  SubagentStart: [{ hooks: [{ type: "command", command: '/bin/bash "$HOME/.claude/hooks/play-sound.sh" subagent', timeout: 5 }] }],
  PostToolUseFailure: [{ hooks: [{ type: "command", command: '/bin/bash "$HOME/.claude/hooks/play-sound.sh" error', timeout: 5 }] }],
  UserPromptSubmit: [{ hooks: [{ type: "command", command: '/bin/bash "$HOME/.claude/hooks/play-sound.sh" prompt', timeout: 5 }] }],
  TaskCompleted: [{ hooks: [{ type: "command", command: '/bin/bash "$HOME/.claude/hooks/play-sound.sh" task-completed', timeout: 5 }] }],
  PreCompact: [{ hooks: [{ type: "command", command: '/bin/bash "$HOME/.claude/hooks/play-sound.sh" compact', timeout: 5 }] }],
  TeammateIdle: [{ hooks: [{ type: "command", command: '/bin/bash "$HOME/.claude/hooks/play-sound.sh" teammate-idle', timeout: 5 }] }],
};

// ─── Commands ────────────────────────────────────────────────────────────────

function showHelp() {
  print("");
  print("  claude-code-sounds");
  print("  ──────────────────────────────");
  print("");
  print("  Usage:");
  print("    npx claude-code-sounds              Install default theme (wc3-peon)");
  print("    npx claude-code-sounds <theme>      Install a specific theme");
  print("    npx claude-code-sounds --list       List available themes");
  print("    npx claude-code-sounds --uninstall  Remove all sounds and hooks");
  print("    npx claude-code-sounds --help       Show this help");
  print("");
}

function showList() {
  print("");
  print("  Available themes:");
  print("");
  for (const t of listThemes()) {
    print(`    ${t.name} — ${t.description}`);
  }
  print("");
}

function uninstall() {
  print("");
  print("  Uninstalling claude-code-sounds...");

  if (fs.existsSync(SOUNDS_DIR)) {
    fs.rmSync(SOUNDS_DIR, { recursive: true });
    print("  Removed ~/.claude/sounds/");
  }

  const hookScript = path.join(HOOKS_DIR, "play-sound.sh");
  if (fs.existsSync(hookScript)) {
    fs.unlinkSync(hookScript);
    print("  Removed ~/.claude/hooks/play-sound.sh");
  }

  if (fs.existsSync(SETTINGS_PATH)) {
    const settings = readSettings();
    delete settings.hooks;
    writeSettings(settings);
    print("  Removed hooks from settings.json");
  }

  print("");
  print("  Done. All sounds removed.");
  print("");
}

function install(themeName) {
  const themeDir = path.join(THEMES_DIR, themeName);
  const themeJsonPath = path.join(themeDir, "theme.json");

  if (!fs.existsSync(themeJsonPath)) {
    die(`Theme '${themeName}' not found.\n\nAvailable themes:\n${listThemes().map((t) => `  ${t.name} — ${t.description}`).join("\n")}`);
  }

  const theme = JSON.parse(fs.readFileSync(themeJsonPath, "utf-8"));
  const categories = Object.keys(theme.sounds);

  // Preflight
  try {
    exec("which afplay");
  } catch {
    die("afplay not found. This tool requires macOS.");
  }

  print("");
  print("  claude-code-sounds");
  print("  ──────────────────────────────");
  print(`  Theme: ${theme.name}`);
  print("");

  // 1. Create directories
  print("  [1/4] Creating directories...");
  for (const cat of categories) {
    mkdirp(path.join(SOUNDS_DIR, cat));
  }
  mkdirp(HOOKS_DIR);

  // 2. Download sounds
  print("  [2/4] Downloading sounds...");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-sounds-"));

  try {
    const downloadScript = path.join(themeDir, "download.sh");
    if (fs.existsSync(downloadScript)) {
      exec(`bash "${downloadScript}" "${SOUNDS_DIR}" "${tmpDir}"`, { stdio: "inherit" });
    }

    // 3. Sort sounds
    print("  [3/4] Sorting sounds...");

    // Clear existing sounds
    for (const cat of categories) {
      const catDir = path.join(SOUNDS_DIR, cat);
      for (const f of fs.readdirSync(catDir)) {
        if (f.endsWith(".wav") || f.endsWith(".mp3")) {
          fs.unlinkSync(path.join(catDir, f));
        }
      }
    }

    // Copy files based on theme.json
    const srcBase = path.join(tmpDir, "Orc");
    for (const [category, config] of Object.entries(theme.sounds)) {
      for (const file of config.files) {
        let srcFile;
        if (file.src.startsWith("@soundfxcenter/")) {
          srcFile = path.join(srcBase, path.basename(file.src));
        } else {
          srcFile = path.join(srcBase, file.src);
        }

        const destFile = path.join(SOUNDS_DIR, category, file.name);
        if (fs.existsSync(srcFile)) {
          fs.copyFileSync(srcFile, destFile);
        } else {
          print(`    Warning: ${file.src} not found, skipping`);
        }
      }
    }

    // 4. Install hooks
    print("  [4/4] Installing hooks...");

    // Copy play-sound.sh
    const hookSrc = path.join(PKG_DIR, "hooks", "play-sound.sh");
    const hookDest = path.join(HOOKS_DIR, "play-sound.sh");
    fs.copyFileSync(hookSrc, hookDest);
    fs.chmodSync(hookDest, 0o755);

    // Merge hooks into settings.json
    const settings = readSettings();
    settings.hooks = HOOKS_CONFIG;
    writeSettings(settings);

    // Summary
    print("");
    print("  Installed! Here's what you'll hear:");
    print("  ─────────────────────────────────────");

    let total = 0;
    for (const [cat, config] of Object.entries(theme.sounds)) {
      const count = config.files.length;
      total += count;
      print(`    ${cat} (${count}) — ${config.description}`);
    }

    print("");
    print(`  ${total} sound files across ${categories.length} events.`);
    print("  Start a new Claude Code session to hear it!");
    print("");
    print("  Zug zug.");
    print("");
  } finally {
    // Cleanup
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const arg = args[0] || "wc3-peon";

switch (arg) {
  case "--help":
  case "-h":
    showHelp();
    break;
  case "--list":
  case "-l":
    showList();
    break;
  case "--uninstall":
  case "--remove":
    uninstall();
    break;
  default:
    install(arg);
}
