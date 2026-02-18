#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");
const readline = require("readline");
const { execSync, spawn } = require("child_process");

// ─── Paths ───────────────────────────────────────────────────────────────────

const PKG_DIR = path.resolve(__dirname, "..");
const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const SOUNDS_DIR = path.join(CLAUDE_DIR, "sounds");
const HOOKS_DIR = path.join(CLAUDE_DIR, "hooks");
const SETTINGS_PATH = path.join(CLAUDE_DIR, "settings.json");
const THEMES_DIR = path.join(PKG_DIR, "themes");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function print(msg = "") {
  process.stdout.write(msg + "\n");
}

function die(msg) {
  console.error(`\n  Error: ${msg}\n`);
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

function hasCommand(name) {
  try {
    exec(`which ${name}`);
    return true;
  } catch {
    return false;
  }
}

// ─── ANSI helpers ────────────────────────────────────────────────────────────

const CSI = "\x1b[";
const CLEAR_LINE = `${CSI}2K`;
const HIDE_CURSOR = `${CSI}?25l`;
const SHOW_CURSOR = `${CSI}?25h`;
const BOLD = `${CSI}1m`;
const DIM = `${CSI}2m`;
const RESET = `${CSI}0m`;
const GREEN = `${CSI}32m`;
const RED = `${CSI}31m`;
const CYAN = `${CSI}36m`;
const YELLOW = `${CSI}33m`;

function moveCursorUp(n) {
  if (n > 0) process.stdout.write(`${CSI}${n}A`);
}

function clearLines(n) {
  for (let i = 0; i < n; i++) {
    process.stdout.write(`${CLEAR_LINE}\n`);
  }
  moveCursorUp(n);
}

// ─── Interactive UI ──────────────────────────────────────────────────────────

let previewProcess = null;

function killPreview() {
  if (previewProcess) {
    try { previewProcess.kill(); } catch {}
    previewProcess = null;
  }
}

function playPreview(filePath) {
  killPreview();
  if (fs.existsSync(filePath)) {
    previewProcess = spawn("afplay", [filePath], { stdio: "ignore", detached: true });
    previewProcess.unref();
    previewProcess.on("exit", () => { previewProcess = null; });
  }
}

function cleanupAndExit() {
  killPreview();
  process.stdout.write(SHOW_CURSOR);
  print("\n");
  process.exit(0);
}

/**
 * Single-select menu with arrow keys.
 * Returns the index of the chosen option.
 */
function select(title, options) {
  return new Promise((resolve) => {
    let cursor = 0;
    const lineCount = options.length + 3; // title + blank + options + hint

    function render(initial) {
      if (!initial) moveCursorUp(lineCount);
      print(`  ${title}\n`);
      for (let i = 0; i < options.length; i++) {
        const prefix = i === cursor ? `${CYAN}  ❯ ` : "    ";
        const label = options[i].label;
        const desc = options[i].description ? ` ${DIM}— ${options[i].description}${RESET}` : "";
        print(`${prefix}${RESET}${i === cursor ? BOLD : ""}${label}${RESET}${desc}`);
      }
      print(`${DIM}  ↑↓ navigate · enter select${RESET}`);
    }

    process.stdout.write(HIDE_CURSOR);
    render(true);

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");

    function onKey(key) {
      // Ctrl+C or q
      if (key === "\x03" || key === "q") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onKey);
        cleanupAndExit();
        return;
      }

      // Arrow up
      if (key === "\x1b[A" || key === "k") {
        cursor = (cursor - 1 + options.length) % options.length;
        render(false);
        return;
      }

      // Arrow down
      if (key === "\x1b[B" || key === "j") {
        cursor = (cursor + 1) % options.length;
        render(false);
        return;
      }

      // Enter
      if (key === "\r" || key === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onKey);
        // Redraw final state
        moveCursorUp(lineCount);
        clearLines(lineCount);
        print(`  ${title} ${GREEN}${options[cursor].label}${RESET}\n`);
        process.stdout.write(SHOW_CURSOR);
        resolve(cursor);
        return;
      }
    }

    process.stdin.on("data", onKey);
  });
}

/**
 * Multi-select checklist with toggle, preview, and confirm.
 * Returns array of selected indices.
 */
function multiSelect(title, items, defaults, previewDir) {
  return new Promise((resolve) => {
    let cursor = 0;
    const checked = items.map((_, i) => defaults.includes(i));
    const lineCount = items.length + 3; // title + blank + items + hint

    function render(initial) {
      if (!initial) moveCursorUp(lineCount);
      print(`  ${title}\n`);
      for (let i = 0; i < items.length; i++) {
        const pointer = i === cursor ? `${CYAN}  ❯ ` : "    ";
        const box = checked[i] ? `${GREEN}[✓]${RESET}` : `${DIM}[ ]${RESET}`;
        const label = items[i].label;
        const desc = items[i].description ? `  ${DIM}${items[i].description}${RESET}` : "";
        print(`${pointer}${RESET}${box} ${label}${desc}`);
      }
      const previewHint = previewDir ? " · p preview" : "";
      print(`${DIM}  ↑↓ navigate · space toggle${previewHint} · enter confirm${RESET}`);
    }

    process.stdout.write(HIDE_CURSOR);
    render(true);

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");

    function onKey(key) {
      if (key === "\x03" || key === "q") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onKey);
        killPreview();
        cleanupAndExit();
        return;
      }

      if (key === "\x1b[A" || key === "k") {
        cursor = (cursor - 1 + items.length) % items.length;
        render(false);
        return;
      }

      if (key === "\x1b[B" || key === "j") {
        cursor = (cursor + 1) % items.length;
        render(false);
        return;
      }

      // Space — toggle
      if (key === " ") {
        checked[cursor] = !checked[cursor];
        render(false);
        return;
      }

      // p — preview sound
      if (key === "p" && previewDir && items[cursor].file) {
        const soundPath = path.join(previewDir, items[cursor].file);
        playPreview(soundPath);
        return;
      }

      // Enter — confirm
      if (key === "\r" || key === "\n") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onKey);
        killPreview();

        const selected = [];
        for (let i = 0; i < checked.length; i++) {
          if (checked[i]) selected.push(i);
        }

        // Redraw final state
        moveCursorUp(lineCount);
        clearLines(lineCount);
        const count = selected.length;
        print(`  ${title} ${GREEN}${count}/${items.length} selected${RESET}\n`);
        process.stdout.write(SHOW_CURSOR);
        resolve(selected);
        return;
      }
    }

    process.stdin.on("data", onKey);
  });
}

/**
 * Y/n confirmation prompt.
 */
function confirm(message, defaultYes = true) {
  return new Promise((resolve) => {
    const hint = defaultYes ? "Y/n" : "y/N";
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`  ${message} (${hint}) `, (answer) => {
      rl.close();
      const a = answer.trim().toLowerCase();
      if (a === "") resolve(defaultYes);
      else resolve(a === "y" || a === "yes");
    });
  });
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

// ─── Non-Interactive Commands ───────────────────────────────────────────────

function showHelp() {
  print("");
  print("  claude-code-sounds");
  print("  ──────────────────────────────");
  print("");
  print("  Usage:");
  print("    npx claude-code-sounds              Interactive install");
  print("    npx claude-code-sounds --yes         Install defaults, skip prompts");
  print("    npx claude-code-sounds --list        List available themes");
  print("    npx claude-code-sounds --uninstall   Remove all sounds and hooks");
  print("    npx claude-code-sounds --help        Show this help");
  print("");
  print("  Flags:");
  print("    -y, --yes       Skip all prompts, use defaults");
  print("    -l, --list      List available themes");
  print("    -h, --help      Show this help");
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
    print("    Removed ~/.claude/sounds/");
  }

  const hookScript = path.join(HOOKS_DIR, "play-sound.sh");
  if (fs.existsSync(hookScript)) {
    fs.unlinkSync(hookScript);
    print("    Removed ~/.claude/hooks/play-sound.sh");
  }

  if (fs.existsSync(SETTINGS_PATH)) {
    const settings = readSettings();
    delete settings.hooks;
    writeSettings(settings);
    print("    Removed hooks from settings.json");
  }

  print("");
  print("  Done. All sounds removed.");
  print("");
}

// ─── Install Flow ───────────────────────────────────────────────────────────

async function interactiveInstall(autoYes) {
  print("");
  print(`  ${BOLD}claude-code-sounds${RESET}`);
  print("  ──────────────────────────────");
  print("");

  // ── Step 1: Dependency Check ──────────────────────────────────────────────

  const deps = ["afplay", "curl", "unzip"];
  const missing = [];

  print("  Checking dependencies...");
  for (const dep of deps) {
    const ok = hasCommand(dep);
    if (ok) {
      print(`    ${GREEN}✓${RESET} ${dep}`);
    } else {
      print(`    ${RED}✗${RESET} ${dep} — required${dep === "afplay" ? " (macOS only)" : ""}`);
      missing.push(dep);
    }
  }
  print("");

  if (missing.includes("afplay")) {
    die("afplay is not available. claude-code-sounds requires macOS.");
  }

  if (missing.length > 0) {
    if (autoYes) {
      die(`Missing dependencies: ${missing.join(", ")}. Install them and try again.`);
    }

    const installDeps = await confirm(`Install missing dependencies with Homebrew?`, true);
    if (installDeps) {
      try {
        exec("which brew");
      } catch {
        die("Homebrew not found. Install missing dependencies manually:\n    brew install " + missing.join(" "));
      }
      print(`  Installing ${missing.join(", ")}...`);
      try {
        exec(`brew install ${missing.join(" ")}`, { stdio: "inherit" });
        print(`  ${GREEN}✓${RESET} Dependencies installed.\n`);
      } catch {
        die("Failed to install dependencies. Run manually:\n    brew install " + missing.join(" "));
      }
    } else {
      die("Missing dependencies. Install them manually:\n    brew install " + missing.join(" "));
    }
  }

  // ── Step 2: Theme Selection ───────────────────────────────────────────────

  const themes = listThemes();
  let selectedTheme;

  if (themes.length === 0) {
    die("No themes found in themes/ directory.");
  } else if (themes.length === 1 || autoYes) {
    selectedTheme = themes[0];
    print(`  Theme: ${BOLD}${selectedTheme.display}${RESET} — ${selectedTheme.description}\n`);
  } else {
    const options = themes.map((t) => ({ label: t.display, description: t.description }));
    const idx = await select("Select a theme:", options);
    selectedTheme = themes[idx];
  }

  // ── Step 3: Download ──────────────────────────────────────────────────────

  const themeDir = path.join(THEMES_DIR, selectedTheme.name);
  const themeJsonPath = path.join(themeDir, "theme.json");
  const theme = JSON.parse(fs.readFileSync(themeJsonPath, "utf-8"));
  const categories = Object.keys(theme.sounds);

  // Create directories
  for (const cat of categories) {
    mkdirp(path.join(SOUNDS_DIR, cat));
  }
  mkdirp(HOOKS_DIR);

  print("  Downloading sounds...");
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-sounds-"));

  try {
    const downloadScript = path.join(themeDir, "download.sh");
    if (fs.existsSync(downloadScript)) {
      exec(`bash "${downloadScript}" "${SOUNDS_DIR}" "${tmpDir}"`, { stdio: "inherit" });
    }
    print(`  ${GREEN}✓${RESET} Download complete.\n`);

    // ── Step 4: Customize or Accept Defaults ──────────────────────────────

    // Build a selection map: category -> array of file indices to include
    const selections = {};
    for (const cat of categories) {
      selections[cat] = theme.sounds[cat].files.map((_, i) => i);
    }

    if (!autoYes) {
      const customizeOptions = [
        { label: "No, use defaults", description: "Recommended" },
        { label: "Yes, let me pick", description: "Choose sounds per hook" },
      ];
      const customizeIdx = await select("Customize sounds for each hook?", customizeOptions);

      if (customizeIdx === 1) {
        // Customize each category
        for (const cat of categories) {
          const config = theme.sounds[cat];
          const items = config.files.map((f) => ({
            label: f.name.replace(/\.(wav|mp3)$/, ""),
            description: f.description || "",
            file: f.name,
          }));
          const defaults = config.files.map((_, i) => i); // all selected by default

          // Build preview dir: sounds are in tmpDir/Orc/... but we need them by name
          // Copy files to a temp preview dir first
          const previewDir = path.join(tmpDir, "_preview", cat);
          mkdirp(previewDir);
          const srcBase = path.join(tmpDir, "Orc");
          for (const file of config.files) {
            let srcFile;
            if (file.src.startsWith("@soundfxcenter/")) {
              srcFile = path.join(srcBase, path.basename(file.src));
            } else {
              srcFile = path.join(srcBase, file.src);
            }
            const destFile = path.join(previewDir, file.name);
            if (fs.existsSync(srcFile)) {
              fs.copyFileSync(srcFile, destFile);
            }
          }

          const selected = await multiSelect(
            `${BOLD}${cat}${RESET} ${DIM}— ${config.description}${RESET}`,
            items,
            defaults,
            previewDir
          );
          selections[cat] = selected;
        }
      }
    }

    // ── Step 5: Install & Summary ─────────────────────────────────────────

    print("  Installing sounds...");

    // Clear existing sounds
    for (const cat of categories) {
      const catDir = path.join(SOUNDS_DIR, cat);
      for (const f of fs.readdirSync(catDir)) {
        if (f.endsWith(".wav") || f.endsWith(".mp3")) {
          fs.unlinkSync(path.join(catDir, f));
        }
      }
    }

    // Copy selected files
    const srcBase = path.join(tmpDir, "Orc");
    let total = 0;
    for (const [category, config] of Object.entries(theme.sounds)) {
      const selectedIndices = selections[category];
      for (const idx of selectedIndices) {
        const file = config.files[idx];
        let srcFile;
        if (file.src.startsWith("@soundfxcenter/")) {
          srcFile = path.join(srcBase, path.basename(file.src));
        } else {
          srcFile = path.join(srcBase, file.src);
        }

        const destFile = path.join(SOUNDS_DIR, category, file.name);
        if (fs.existsSync(srcFile)) {
          fs.copyFileSync(srcFile, destFile);
          total++;
        } else {
          print(`    ${YELLOW}⚠${RESET} ${file.src} not found, skipping`);
        }
      }
    }

    // Copy play-sound.sh hook
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
    print(`  ${GREEN}✓${RESET} Installed! Here's what you'll hear:`);
    print("  ─────────────────────────────────────");

    for (const [cat, config] of Object.entries(theme.sounds)) {
      const count = selections[cat].length;
      const totalAvailable = config.files.length;
      const suffix = count < totalAvailable ? ` (${count}/${totalAvailable})` : ` (${count})`;
      print(`    ${cat}${suffix} — ${config.description}`);
    }

    print("");
    print(`  ${total} sound files across ${categories.length} events.`);
    print("  Start a new Claude Code session to hear it!");
    print("");
    print("  Zug zug.");
    print("");
  } finally {
    killPreview();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = new Set(args);
const autoYes = flags.has("--yes") || flags.has("-y");

// Handle non-interactive commands first
if (flags.has("--help") || flags.has("-h")) {
  showHelp();
} else if (flags.has("--list") || flags.has("-l")) {
  showList();
} else if (flags.has("--uninstall") || flags.has("--remove")) {
  uninstall();
} else {
  interactiveInstall(autoYes).catch((err) => {
    killPreview();
    process.stdout.write(SHOW_CURSOR);
    die(err.message);
  });
}
