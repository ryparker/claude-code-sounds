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
const INSTALLED_PATH = path.join(SOUNDS_DIR, ".installed.json");

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

function readInstalled() {
  if (fs.existsSync(INSTALLED_PATH)) {
    return JSON.parse(fs.readFileSync(INSTALLED_PATH, "utf-8"));
  }
  return null;
}

function writeInstalled(themeName) {
  mkdirp(SOUNDS_DIR);
  fs.writeFileSync(INSTALLED_PATH, JSON.stringify({ theme: themeName }, null, 2) + "\n");
}

/**
 * Check if sounds are already installed.
 * Returns { theme, themeDisplay, totalEnabled, totalAvailable, categories } or null.
 */
function getExistingInstall() {
  const installed = readInstalled();
  if (!installed) return null;

  const themeJsonPath = path.join(THEMES_DIR, installed.theme, "theme.json");
  if (!fs.existsSync(themeJsonPath)) return null;

  const theme = JSON.parse(fs.readFileSync(themeJsonPath, "utf-8"));
  let totalEnabled = 0;
  const totalAvailable = Object.values(theme.sounds).reduce((sum, c) => sum + c.files.length, 0);

  for (const cat of Object.keys(theme.sounds)) {
    const catDir = path.join(SOUNDS_DIR, cat);
    try {
      for (const f of fs.readdirSync(catDir)) {
        if (f.endsWith(".wav") || f.endsWith(".mp3")) totalEnabled++;
      }
    } catch {}
  }

  if (totalEnabled === 0) return null;

  return {
    theme: installed.theme,
    themeDisplay: theme.name,
    themeDescription: theme.description,
    totalEnabled,
    totalAvailable,
  };
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
 * Returns array of selected indices, or null if back was pressed.
 */
function multiSelect(title, items, defaults, previewDir, { allowBack = false } = {}) {
  return new Promise((resolve) => {
    let cursor = 0;
    let scrollTop = 0;
    const checked = items.map((_, i) => defaults.includes(i));

    // Calculate scrolling dimensions
    const termRows = process.stdout.rows || 24;
    const maxItemRows = Math.max(5, termRows - 5); // 5 = title + blank + hint + 2 buffer
    const needsScroll = items.length > maxItemRows;
    // When scrolling, reserve 2 rows for ▲/▼ indicators (always present for stable line count)
    const visibleCount = needsScroll ? maxItemRows - 2 : items.length;
    const lineCount = needsScroll ? maxItemRows + 3 : items.length + 3;

    function adjustScroll() {
      if (!needsScroll) return;
      if (cursor < scrollTop) scrollTop = cursor;
      if (cursor >= scrollTop + visibleCount) scrollTop = cursor - visibleCount + 1;
    }

    function render(initial) {
      if (!initial) moveCursorUp(lineCount);
      print(`  ${title}\n`);

      if (needsScroll) {
        const above = scrollTop;
        const below = items.length - scrollTop - visibleCount;
        print(above > 0 ? `${DIM}    ▲ ${above} more${RESET}` : "");
        for (let i = scrollTop; i < scrollTop + visibleCount; i++) {
          const pointer = i === cursor ? `${CYAN}  ❯ ` : "    ";
          const box = checked[i] ? `${GREEN}[✓]${RESET}` : `${DIM}[ ]${RESET}`;
          const label = items[i].label;
          const desc = items[i].description ? `  ${DIM}${items[i].description}${RESET}` : "";
          print(`${pointer}${RESET}${box} ${label}${desc}`);
        }
        print(below > 0 ? `${DIM}    ▼ ${below} more${RESET}` : "");
      } else {
        for (let i = 0; i < items.length; i++) {
          const pointer = i === cursor ? `${CYAN}  ❯ ` : "    ";
          const box = checked[i] ? `${GREEN}[✓]${RESET}` : `${DIM}[ ]${RESET}`;
          const label = items[i].label;
          const desc = items[i].description ? `  ${DIM}${items[i].description}${RESET}` : "";
          print(`${pointer}${RESET}${box} ${label}${desc}`);
        }
      }

      const previewHint = previewDir ? " · p preview" : "";
      const backHint = allowBack ? "← back · " : "";
      print(`${DIM}  ${backHint}↑↓ navigate · space toggle · a all${previewHint} · →/enter confirm${RESET}`);
    }

    process.stdout.write(HIDE_CURSOR);
    adjustScroll();
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

      // Left arrow — go back
      if (allowBack && key === "\x1b[D") {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener("data", onKey);
        killPreview();
        moveCursorUp(lineCount);
        clearLines(lineCount);
        process.stdout.write(SHOW_CURSOR);
        resolve(null);
        return;
      }

      if (key === "\x1b[A" || key === "k") {
        cursor = (cursor - 1 + items.length) % items.length;
        adjustScroll();
        render(false);
        return;
      }

      if (key === "\x1b[B" || key === "j") {
        cursor = (cursor + 1) % items.length;
        adjustScroll();
        render(false);
        return;
      }

      // Space — toggle
      if (key === " ") {
        checked[cursor] = !checked[cursor];
        render(false);
        return;
      }

      // a — toggle all
      if (key === "a") {
        const allChecked = checked.every(Boolean);
        checked.fill(!allChecked);
        render(false);
        return;
      }

      // p — preview sound
      if (key === "p" && previewDir && items[cursor].file) {
        const soundPath = path.join(previewDir, items[cursor].file);
        playPreview(soundPath);
        return;
      }

      // Enter or right arrow — confirm
      if (key === "\r" || key === "\n" || key === "\x1b[C") {
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

// ─── Sound Item Builder ─────────────────────────────────────────────────────

/**
 * Build the full list of sound items for a category.
 * Native sounds (from this category's theme.json entry) come first,
 * then borrowed sounds from all other categories, deduplicated by filename.
 */
function buildCategoryItems(theme, category) {
  const config = theme.sounds[category];
  const categories = Object.keys(theme.sounds);
  const items = [];
  const seen = new Set();

  // Native sounds first
  for (const f of config.files) {
    seen.add(f.name);
    items.push({
      label: f.name.replace(/\.(wav|mp3)$/, ""),
      description: f.description || "",
      file: f.name,
      src: f.src,
      native: true,
      originCat: category,
    });
  }

  // Borrowed sounds from other categories
  for (const otherCat of categories) {
    if (otherCat === category) continue;
    for (const f of theme.sounds[otherCat].files) {
      if (seen.has(f.name)) continue;
      seen.add(f.name);
      items.push({
        label: f.name.replace(/\.(wav|mp3)$/, ""),
        description: `from ${otherCat}`,
        file: f.name,
        src: f.src,
        native: false,
        originCat: otherCat,
      });
    }
  }

  return items;
}

/**
 * Resolve a sound file's source from download (tmpDir/Orc/...).
 */
function resolveDownloadSrc(srcBase, src) {
  if (src.startsWith("@soundfxcenter/")) {
    return path.join(srcBase, path.basename(src));
  }
  return path.join(srcBase, src);
}

// ─── Reconfigure Flow ───────────────────────────────────────────────────────

async function reconfigure(existingInstall) {
  const themeDir = path.join(THEMES_DIR, existingInstall.theme);
  const theme = JSON.parse(fs.readFileSync(path.join(themeDir, "theme.json"), "utf-8"));
  const categories = Object.keys(theme.sounds);
  const tmpDirs = [];

  try {
    let catIdx = 0;
    while (catIdx < categories.length) {
      const cat = categories[catIdx];
      const config = theme.sounds[cat];
      const catDir = path.join(SOUNDS_DIR, cat);
      const disabledDir = path.join(catDir, ".disabled");
      const items = buildCategoryItems(theme, cat);

      // Determine current state: checked if file exists in category dir
      const defaults = [];
      for (let i = 0; i < items.length; i++) {
        if (fs.existsSync(path.join(catDir, items[i].file))) {
          defaults.push(i);
        }
      }

      // Build preview dir with all sounds from all possible locations
      const previewDir = fs.mkdtempSync(path.join(os.tmpdir(), `claude-preview-`));
      tmpDirs.push(previewDir);
      for (const item of items) {
        const originCatDir = path.join(SOUNDS_DIR, item.originCat);
        const originDisabledDir = path.join(originCatDir, ".disabled");
        const searchDirs = [catDir, disabledDir, originCatDir, originDisabledDir];
        for (const dir of searchDirs) {
          const p = path.join(dir, item.file);
          if (fs.existsSync(p)) {
            fs.copyFileSync(p, path.join(previewDir, item.file));
            break;
          }
        }
      }

      const selected = await multiSelect(
        `${BOLD}${cat}${RESET} ${DIM}— ${config.description}${RESET}`,
        items,
        defaults,
        previewDir,
        { allowBack: catIdx > 0 }
      );

      // Back was pressed — go to previous category
      if (selected === null) {
        catIdx--;
        continue;
      }

      // Apply changes
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const isSelected = selected.includes(i);
        const enabledPath = path.join(catDir, item.file);

        if (item.native) {
          const disabledPath = path.join(disabledDir, item.file);
          if (isSelected && !fs.existsSync(enabledPath) && fs.existsSync(disabledPath)) {
            fs.renameSync(disabledPath, enabledPath);
          } else if (!isSelected && fs.existsSync(enabledPath)) {
            mkdirp(disabledDir);
            fs.renameSync(enabledPath, disabledPath);
          }
        } else {
          // Borrowed sound: copy in or delete
          if (isSelected && !fs.existsSync(enabledPath)) {
            const previewFile = path.join(previewDir, item.file);
            if (fs.existsSync(previewFile)) {
              fs.copyFileSync(previewFile, enabledPath);
            }
          } else if (!isSelected && fs.existsSync(enabledPath)) {
            fs.unlinkSync(enabledPath);
          }
        }
      }

      catIdx++;
    }
  } finally {
    for (const dir of tmpDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  // Summary
  let total = 0;
  print(`  ${GREEN}✓${RESET} Configuration updated!`);
  print("  ─────────────────────────────────────");

  for (const cat of categories) {
    const catDir = path.join(SOUNDS_DIR, cat);
    let count = 0;
    try {
      for (const f of fs.readdirSync(catDir)) {
        if (f.endsWith(".wav") || f.endsWith(".mp3")) count++;
      }
    } catch {}
    total += count;
    print(`    ${cat} (${count}) — ${theme.sounds[cat].description}`);
  }

  print("");
  print(`  ${total} sound files across ${categories.length} events.`);
  print("");
}

// ─── Install Flow ───────────────────────────────────────────────────────────

async function interactiveInstall(autoYes) {
  print("");
  print(`  ${BOLD}claude-code-sounds${RESET}`);
  print("  ──────────────────────────────");
  print("");

  // ── Detect existing install ───────────────────────────────────────────────

  const existingInstall = getExistingInstall();

  if (existingInstall && !autoYes) {
    print(`  ${GREEN}✓${RESET} Already installed — ${BOLD}${existingInstall.themeDisplay}${RESET}`);
    print(`    ${existingInstall.totalEnabled}/${existingInstall.totalAvailable} sounds enabled\n`);

    const actionIdx = await select("What would you like to do?", [
      { label: "Reconfigure", description: "Choose which sounds are enabled" },
      { label: "Reinstall", description: "Re-download and start fresh" },
      { label: "Uninstall", description: "Remove all sounds and hooks" },
    ]);

    if (actionIdx === 0) {
      await reconfigure(existingInstall);
      return;
    }
    if (actionIdx === 2) {
      uninstall();
      return;
    }
    // actionIdx === 1 falls through to full install
  }

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

    // Build items and selections for each category (includes all theme sounds)
    const categoryItems = {};
    const selections = {};
    for (const cat of categories) {
      const items = buildCategoryItems(theme, cat);
      categoryItems[cat] = items;
      // Default: select only native sounds
      selections[cat] = items.map((item, i) => item.native ? i : -1).filter(i => i >= 0);
    }

    if (!autoYes) {
      const customizeOptions = [
        { label: "No, use defaults", description: "Recommended" },
        { label: "Yes, let me pick", description: "Choose sounds per hook" },
      ];
      const customizeIdx = await select("Customize sounds for each hook?", customizeOptions);

      if (customizeIdx === 1) {
        const srcBase = path.join(tmpDir, "Orc");
        let catIdx = 0;

        while (catIdx < categories.length) {
          const cat = categories[catIdx];
          const config = theme.sounds[cat];
          const items = categoryItems[cat];
          const defaults = selections[cat];

          // Build preview dir with ALL theme sounds
          const previewDir = path.join(tmpDir, "_preview", cat);
          mkdirp(previewDir);
          for (const item of items) {
            const srcFile = resolveDownloadSrc(srcBase, item.src);
            const destFile = path.join(previewDir, item.file);
            if (fs.existsSync(srcFile)) {
              fs.copyFileSync(srcFile, destFile);
            }
          }

          const selected = await multiSelect(
            `${BOLD}${cat}${RESET} ${DIM}— ${config.description}${RESET}`,
            items,
            defaults,
            previewDir,
            { allowBack: catIdx > 0 }
          );

          if (selected === null) {
            catIdx--;
            continue;
          }

          selections[cat] = selected;
          catIdx++;
        }
      }
    }

    // ── Step 5: Install & Summary ─────────────────────────────────────────

    print("  Installing sounds...");

    // Clear existing sounds and .disabled dirs
    for (const cat of categories) {
      const catDir = path.join(SOUNDS_DIR, cat);
      for (const f of fs.readdirSync(catDir)) {
        const fp = path.join(catDir, f);
        if (f === ".disabled") {
          fs.rmSync(fp, { recursive: true, force: true });
        } else if (f.endsWith(".wav") || f.endsWith(".mp3")) {
          fs.unlinkSync(fp);
        }
      }
    }

    // Copy files from download based on selections
    const srcBase = path.join(tmpDir, "Orc");
    let total = 0;
    for (const cat of categories) {
      const items = categoryItems[cat];
      const selectedIndices = selections[cat];
      const catDir = path.join(SOUNDS_DIR, cat);
      const disabledDir = path.join(catDir, ".disabled");

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const srcFile = resolveDownloadSrc(srcBase, item.src);

        if (!fs.existsSync(srcFile)) {
          if (item.native) {
            print(`    ${YELLOW}⚠${RESET} ${item.src} not found, skipping`);
          }
          continue;
        }

        if (selectedIndices.includes(i)) {
          fs.copyFileSync(srcFile, path.join(catDir, item.file));
          total++;
        } else if (item.native) {
          // Save unselected native sounds to .disabled for future reconfigure
          mkdirp(disabledDir);
          fs.copyFileSync(srcFile, path.join(disabledDir, item.file));
        }
        // Unselected borrowed sounds: skip (no need to store)
      }
    }

    // Write install marker
    writeInstalled(selectedTheme.name);

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

    for (const cat of categories) {
      const count = selections[cat].length;
      print(`    ${cat} (${count}) — ${theme.sounds[cat].description}`);
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
