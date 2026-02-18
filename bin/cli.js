#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync, spawn } = require("child_process");
const p = require("@clack/prompts");
const { Prompt } = require("@clack/core");
const color = require("picocolors");

// ─── Paths ───────────────────────────────────────────────────────────────────

const PKG_DIR = path.resolve(__dirname, "..");
const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const SOUNDS_DIR = path.join(CLAUDE_DIR, "sounds");
const HOOKS_DIR = path.join(CLAUDE_DIR, "hooks");
const SETTINGS_PATH = path.join(CLAUDE_DIR, "settings.json");
const THEMES_DIR = path.join(PKG_DIR, "themes");
const INSTALLED_PATH = path.join(SOUNDS_DIR, ".installed.json");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function exec(cmd, opts = {}) {
  return execSync(cmd, { encoding: "utf-8", stdio: "pipe", ...opts });
}

function hasCommand(name) {
  try {
    exec(`which ${name}`);
    return true;
  } catch {
    return false;
  }
}

function listThemes() {
  const themes = [];
  for (const name of fs.readdirSync(THEMES_DIR)) {
    const themeJson = path.join(THEMES_DIR, name, "theme.json");
    if (!fs.existsSync(themeJson)) continue;
    const meta = JSON.parse(fs.readFileSync(themeJson, "utf-8"));
    let soundCount = 0;
    if (meta.sounds) {
      for (const cat of Object.values(meta.sounds)) {
        soundCount += cat.files.length;
      }
    }
    themes.push({
      name,
      description: meta.description || "",
      display: meta.name || name,
      soundCount,
      srcBase: meta.srcBase || name,
      sources: meta.sources || [],
    });
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

function readInstalled() {
  if (fs.existsSync(INSTALLED_PATH)) {
    return JSON.parse(fs.readFileSync(INSTALLED_PATH, "utf-8"));
  }
  return null;
}

function writeInstalled(data) {
  mkdirp(SOUNDS_DIR);
  fs.writeFileSync(INSTALLED_PATH, JSON.stringify(data, null, 2) + "\n");
}

function readThemeJson(themeName) {
  return JSON.parse(
    fs.readFileSync(path.join(THEMES_DIR, themeName, "theme.json"), "utf-8")
  );
}

function resolveDownloadSrc(tmpDir, srcBase, src) {
  if (src.startsWith("@")) {
    return path.join(tmpDir, srcBase, path.basename(src));
  }
  return path.join(tmpDir, srcBase, src);
}

// ─── Preview ─────────────────────────────────────────────────────────────────

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

// ─── Sound Grid Prompt ───────────────────────────────────────────────────────

const HOOKS = [
  { key: "start", abbr: "str", description: "Session starting" },
  { key: "prompt", abbr: "pmt", description: "User submitted prompt" },
  { key: "permission", abbr: "prm", description: "Permission prompt" },
  { key: "stop", abbr: "stp", description: "Done responding" },
  { key: "subagent", abbr: "sub", description: "Spawning subagent" },
  { key: "task-completed", abbr: "tsk", description: "Task finished" },
  { key: "error", abbr: "err", description: "Tool failure" },
  { key: "compact", abbr: "cmp", description: "Context compaction" },
  { key: "idle", abbr: "idl", description: "Waiting for input" },
  { key: "teammate-idle", abbr: "tmt", description: "Teammate went idle" },
  { key: "end", abbr: "end", description: "Session over" },
];

/**
 * A 2D grid prompt for assigning sounds to hooks.
 *
 * Rows are sounds (grouped by theme with visual headers), columns are hooks.
 * Navigate with arrow keys, toggle with space, preview with 'p', toggle
 * entire column with 'a'.
 *
 * @param {object} opts
 * @param {string} opts.message - Prompt title
 * @param {Array<{type: 'header'|'sound', theme: string, label: string, fileName?: string, previewPath?: string}>} opts.rows
 * @param {Array<{key: string, abbr: string, description: string}>} opts.hooks
 * @param {boolean[][]} opts.initialGrid - [soundIndex][hookIndex]
 */
class SoundGrid extends Prompt {
  constructor({ message, rows, hooks, initialGrid }) {
    const soundIndices = [];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].type === 'sound') soundIndices.push(i);
    }

    super({
      render() {
        const grid = this._grid;
        const cursorRow = this._cursorRow;
        const cursorCol = this._cursorCol;
        let scrollTop = this._scrollTop;
        const myRows = this._rows;
        const myHooks = this._hooks;
        const myMessage = this._message;
        const mySoundIndices = this._soundIndices;

        const termCols = process.stdout.columns || 80;
        const termRows = process.stdout.rows || 24;
        const lines = [];

        if (this.state === 'submit') {
          lines.push(`${color.gray(p.S_BAR)}`);
          let totalSel = 0;
          for (const r of grid) for (const c of r) if (c) totalSel++;
          lines.push(`${color.green(p.S_STEP_SUBMIT)}  ${myMessage} ${color.dim(`(${totalSel} assigned)`)}`);
          return lines.join('\n');
        }

        if (this.state === 'cancel') {
          lines.push(`${color.gray(p.S_BAR)}`);
          lines.push(`${color.red(p.S_STEP_ACTIVE)}  ${myMessage}`);
          return lines.join('\n');
        }

        // Active state
        lines.push(`${color.gray(p.S_BAR)}`);
        lines.push(`${color.cyan(p.S_STEP_ACTIVE)}  ${myMessage}`);

        // ── Layout calculation ──
        // Line structure: "│  " (3) + cursor+space (2) + label (labelWidth-2) + [◂] + columns + [▸]
        // Header uses:    "│  " (3) + spaces (labelWidth) + [◂] + columns + [▸]
        // Both total: 3 + labelWidth + margins + visibleCols*4
        const totalHooks = myHooks.length;
        const maxLabelWidth = 25;
        const colWidth = 4;
        const linePrefix = 3; // "│  "

        // First try: all columns without scroll margins
        let labelWidth = maxLabelWidth;
        const noMarginCols = Math.floor((termCols - linePrefix - labelWidth) / colWidth);
        let needsHScroll, visibleCols;

        if (noMarginCols >= totalHooks) {
          needsHScroll = false;
          visibleCols = totalHooks;
        } else {
          // Need horizontal scroll — reserve 2 chars for ◂/▸ indicators
          needsHScroll = true;
          const withMarginCols = Math.floor((termCols - linePrefix - labelWidth - 2) / colWidth);
          if (withMarginCols >= 1) {
            visibleCols = withMarginCols;
          } else {
            // Very narrow — shrink label to fit at least 1 column
            labelWidth = Math.max(8, termCols - linePrefix - 2 - colWidth);
            visibleCols = 1;
          }
        }

        const maxLabel = labelWidth - 2; // label text area after cursor+space

        // ── Horizontal scroll ──
        let colStart = this._colStart || 0;
        if (needsHScroll) {
          if (cursorCol < colStart) colStart = cursorCol;
          if (cursorCol >= colStart + visibleCols) colStart = cursorCol - visibleCols + 1;
          colStart = Math.max(0, Math.min(colStart, totalHooks - visibleCols));
        } else {
          colStart = 0;
        }
        this._colStart = colStart;

        const showLeftArrow = needsHScroll && colStart > 0;
        const showRightArrow = needsHScroll && colStart + visibleCols < totalHooks;
        const leftMargin = needsHScroll ? (showLeftArrow ? color.dim('\u25C2') : ' ') : '';
        const rightMargin = needsHScroll ? (showRightArrow ? color.dim('\u25B8') : ' ') : '';

        // ── Column header line ──
        let headerLine = `${color.gray(p.S_BAR)}  ${''.padEnd(labelWidth)}${leftMargin}`;
        for (let c = colStart; c < colStart + visibleCols; c++) {
          const abbr = myHooks[c].abbr.padStart(colWidth);
          headerLine += c === cursorCol ? color.cyan(color.bold(abbr)) : color.dim(abbr);
        }
        headerLine += rightMargin;
        lines.push(headerLine);

        // ── Vertical scrolling ──
        const reservedLines = 4;
        const maxVisible = Math.max(5, termRows - lines.length - reservedLines - 2);
        const currentRowIdx = mySoundIndices[cursorRow];

        if (currentRowIdx < scrollTop) {
          scrollTop = Math.max(0, currentRowIdx - 1);
        } else if (currentRowIdx >= scrollTop + maxVisible) {
          scrollTop = currentRowIdx - maxVisible + 1;
        }
        if (scrollTop > 0 && myRows[scrollTop]?.type === 'sound') {
          for (let i = scrollTop - 1; i >= Math.max(0, scrollTop - 2); i--) {
            if (myRows[i].type === 'header') {
              scrollTop = i;
              break;
            }
          }
        }

        const showScrollUp = scrollTop > 0;
        const showScrollDown = scrollTop + maxVisible < myRows.length;

        if (showScrollUp) {
          lines.push(`${color.gray(p.S_BAR)}  ${color.dim('  \u25B2')}`);
        }

        // ── Render rows ──
        const contentWidth = needsHScroll
          ? labelWidth + 2 + visibleCols * colWidth
          : labelWidth + visibleCols * colWidth;

        let visibleCount = 0;
        for (let i = scrollTop; i < myRows.length && visibleCount < maxVisible; i++) {
          const row = myRows[i];
          if (row.type === 'header') {
            const hdr = `\u2500\u2500 ${row.label} `;
            const dashLen = Math.max(2, contentWidth - hdr.length);
            lines.push(`${color.gray(p.S_BAR)}  ${color.gray(hdr + '\u2500'.repeat(dashLen))}`);
          } else {
            const soundIdx = mySoundIndices.indexOf(i);
            const isActiveRow = soundIdx === cursorRow;
            const pointer = isActiveRow ? color.cyan('\u203A') : ' ';
            const rawLabel = row.label.length > maxLabel
              ? row.label.substring(0, maxLabel - 1) + '\u2026'
              : row.label;
            const paddedLabel = rawLabel.padEnd(maxLabel);
            const styledLabel = isActiveRow
              ? color.white(paddedLabel)
              : color.dim(paddedLabel);

            let cellsStr = leftMargin;
            for (let c = colStart; c < colStart + visibleCols; c++) {
              const isActive = isActiveRow && c === cursorCol;
              const isChecked = grid[soundIdx][c];
              const cell = isChecked ? ' [x]' : ' [ ]';

              if (isActive) {
                cellsStr += color.cyan(color.bold(cell));
              } else if (isChecked) {
                cellsStr += color.green(cell);
              } else {
                cellsStr += color.dim(cell);
              }
            }
            cellsStr += rightMargin;

            lines.push(`${color.gray(p.S_BAR)}  ${pointer} ${styledLabel}${cellsStr}`);
          }
          visibleCount++;
        }

        if (showScrollDown) {
          lines.push(`${color.gray(p.S_BAR)}  ${color.dim('  \u25BC')}`);
        }

        // ── Footer ──
        lines.push(`${color.gray(p.S_BAR)}`);
        const helpFull = '\u2191\u2193 sounds \u00B7 \u2190\u2192 hooks \u00B7 space toggle \u00B7 p preview \u00B7 a column all \u00B7 enter done';
        const helpShort = '\u2191\u2193/\u2190\u2192 move \u00B7 space \u00B7 p play \u00B7 a all \u00B7 enter';
        const helpText = (helpFull.length + 5 <= termCols) ? helpFull : helpShort;
        lines.push(`${color.gray(p.S_BAR)}  ${color.dim(helpText)}`);

        const hook = myHooks[cursorCol];
        const hookLine = needsHScroll
          ? `${color.dim('Hook:')} ${color.cyan(hook.key)} ${color.dim('\u2014')} ${color.dim(hook.description)} ${color.dim(`(${colStart + 1}\u2013${colStart + visibleCols} of ${totalHooks})`)}`
          : `${color.dim('Hook:')} ${color.cyan(hook.key)} ${color.dim('\u2014')} ${color.dim(hook.description)}`;
        lines.push(`${color.gray(p.S_BAR)}  ${hookLine}`);

        this._scrollTop = scrollTop;
        return lines.join('\n');
      },
    }, false);

    this._rows = rows;
    this._hooks = hooks;
    this._soundIndices = soundIndices;
    this._message = message;
    this._cursorRow = 0;
    this._cursorCol = 0;
    this._grid = initialGrid.map(r => [...r]);
    this._scrollTop = 0;
    this._colStart = 0;

    this.on('cursor', (action) => {
      if (action === 'up') {
        if (this._soundIndices.length > 0) {
          this._cursorRow = (this._cursorRow - 1 + this._soundIndices.length) % this._soundIndices.length;
          const rowIdx = this._soundIndices[this._cursorRow];
          const row = this._rows[rowIdx];
          if (row?.previewPath) playPreview(row.previewPath);
        }
      } else if (action === 'down') {
        if (this._soundIndices.length > 0) {
          this._cursorRow = (this._cursorRow + 1) % this._soundIndices.length;
          const rowIdx = this._soundIndices[this._cursorRow];
          const row = this._rows[rowIdx];
          if (row?.previewPath) playPreview(row.previewPath);
        }
      } else if (action === 'left') {
        this._cursorCol = (this._cursorCol - 1 + this._hooks.length) % this._hooks.length;
      } else if (action === 'right') {
        this._cursorCol = (this._cursorCol + 1) % this._hooks.length;
      } else if (action === 'space') {
        this._grid[this._cursorRow][this._cursorCol] = !this._grid[this._cursorRow][this._cursorCol];
      }
    });

    this.on('key', (char) => {
      if (char === 'p') {
        const rowIdx = this._soundIndices[this._cursorRow];
        const row = this._rows[rowIdx];
        if (row && row.previewPath) {
          playPreview(row.previewPath);
        }
      }
      if (char === 'a') {
        const col = this._cursorCol;
        const allChecked = this._grid.every(r => r[col]);
        for (let i = 0; i < this._grid.length; i++) {
          this._grid[i][col] = !allChecked;
        }
      }
    });

    this.on('finalize', () => {
      if (this.state === 'submit') {
        const result = {};
        for (let c = 0; c < this._hooks.length; c++) {
          const hookKey = this._hooks[c].key;
          result[hookKey] = [];
          for (let r = 0; r < this._soundIndices.length; r++) {
            if (this._grid[r][c]) {
              const rowIdx = this._soundIndices[r];
              const row = this._rows[rowIdx];
              result[hookKey].push({ theme: row.theme, fileName: row.fileName });
            }
          }
        }
        this.value = result;
      }
    });
  }
}

// ─── Download Themes ─────────────────────────────────────────────────────────

function downloadThemes(themeNames, tmpDir) {
  for (const themeName of themeNames) {
    const downloadScript = path.join(THEMES_DIR, themeName, "download.sh");
    if (fs.existsSync(downloadScript)) {
      exec(`bash "${downloadScript}" "${SOUNDS_DIR}" "${tmpDir}"`, {
        stdio: "inherit",
        timeout: 120000,
      });
    }
  }
}

// ─── Install Sounds ──────────────────────────────────────────────────────────

/**
 * Copy selected sound files from tmpDir to SOUNDS_DIR.
 *
 * @param {Object<string, Array<{themeName: string, fileName: string, src: string}>>} selections
 * @param {Object<string, object>} themeData - theme name -> parsed theme.json
 * @param {string} tmpDir
 * @returns {number} Total files installed
 */
function installSounds(selections, themeData, tmpDir) {
  let total = 0;

  for (const [cat, items] of Object.entries(selections)) {
    const catDir = path.join(SOUNDS_DIR, cat);
    mkdirp(catDir);

    // Clear existing sounds in this category
    try {
      for (const f of fs.readdirSync(catDir)) {
        if (f.endsWith(".wav") || f.endsWith(".mp3")) {
          fs.unlinkSync(path.join(catDir, f));
        }
      }
    } catch {}

    // Copy selected sounds
    for (const item of items) {
      const theme = themeData[item.themeName];
      const srcBase = theme.srcBase || item.themeName;
      const srcPath = resolveDownloadSrc(tmpDir, srcBase, item.src);
      const destPath = path.join(catDir, item.fileName);

      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        total++;
      }
    }
  }

  return total;
}

/**
 * Write hooks config and copy play-sound.sh script.
 */
function installHooksConfig() {
  mkdirp(HOOKS_DIR);

  const hookSrc = path.join(PKG_DIR, "hooks", "play-sound.sh");
  const hookDest = path.join(HOOKS_DIR, "play-sound.sh");
  fs.copyFileSync(hookSrc, hookDest);
  fs.chmodSync(hookDest, 0o755);

  const settings = readSettings();
  settings.hooks = HOOKS_CONFIG;
  writeSettings(settings);
}

// ─── Print Summary ───────────────────────────────────────────────────────────

function printSummary(selections) {
  const cats = Object.keys(selections);
  let total = 0;

  for (const cat of cats) {
    const count = selections[cat].length;
    total += count;
    p.log.step(`${cat} (${count})`);
  }

  p.log.success(`Installed ${total} sounds across ${cats.length} hooks.`);
}

// ─── Non-Interactive Commands ────────────────────────────────────────────────

function showHelp() {
  console.log(`
  claude-code-sounds
  ──────────────────────────────

  Usage:
    npx claude-code-sounds              Interactive install
    npx claude-code-sounds --yes        Install defaults, skip prompts
    npx claude-code-sounds --list       List available themes
    npx claude-code-sounds --uninstall  Remove all sounds and hooks
    npx claude-code-sounds --help       Show this help

  Flags:
    -y, --yes       Skip all prompts, use defaults
    -l, --list      List available themes
    -h, --help      Show this help
`);
}

function showList() {
  const themes = listThemes();
  console.log("\n  Available themes:\n");
  for (const t of themes) {
    const src = t.sources.length > 0 ? ` [${t.sources.join(", ")}]` : "";
    console.log(`    ${t.name} — ${t.description} (${t.soundCount} sounds)${src}`);
  }
  console.log();
}

function uninstallAll() {
  if (fs.existsSync(SOUNDS_DIR)) {
    fs.rmSync(SOUNDS_DIR, { recursive: true });
    p.log.step("Removed ~/.claude/sounds/");
  }

  const hookScript = path.join(HOOKS_DIR, "play-sound.sh");
  if (fs.existsSync(hookScript)) {
    fs.unlinkSync(hookScript);
    p.log.step("Removed ~/.claude/hooks/play-sound.sh");
  }

  if (fs.existsSync(SETTINGS_PATH)) {
    const settings = readSettings();
    delete settings.hooks;
    writeSettings(settings);
    p.log.step("Removed hooks from settings.json");
  }
}

// ─── Check Dependencies ─────────────────────────────────────────────────────

function checkDependencies() {
  const deps = ["afplay", "curl", "unzip"];
  const missing = [];

  for (const dep of deps) {
    if (!hasCommand(dep)) missing.push(dep);
  }

  if (missing.includes("afplay")) {
    p.cancel("afplay is not available. claude-code-sounds requires macOS.");
    process.exit(1);
  }

  if (missing.length > 0) {
    p.cancel(`Missing dependencies: ${missing.join(", ")}. Install them and try again.`);
    process.exit(1);
  }
}

// ─── Detect Existing Install ─────────────────────────────────────────────────

function detectExistingInstall() {
  const installed = readInstalled();
  if (!installed) return null;

  // Support both old format { theme: "name" } and new { themes: [...], mode }
  const themeNames = installed.themes || (installed.theme ? [installed.theme] : []);
  if (themeNames.length === 0) return null;

  // Count enabled sounds across all categories
  let totalEnabled = 0;
  const allCategories = new Set();

  for (const themeName of themeNames) {
    try {
      const theme = readThemeJson(themeName);
      for (const cat of Object.keys(theme.sounds)) {
        allCategories.add(cat);
      }
    } catch {}
  }

  for (const cat of allCategories) {
    const catDir = path.join(SOUNDS_DIR, cat);
    try {
      for (const f of fs.readdirSync(catDir)) {
        if (f.endsWith(".wav") || f.endsWith(".mp3")) totalEnabled++;
      }
    } catch {}
  }

  if (totalEnabled === 0) return null;

  const displays = themeNames.map((n) => {
    try { return readThemeJson(n).name; } catch { return n; }
  });

  return {
    themes: themeNames,
    themeDisplays: displays,
    totalEnabled,
    mode: installed.mode || "quick",
  };
}

// ─── Quick Install ───────────────────────────────────────────────────────────

async function quickInstall(theme) {
  const themeJson = readThemeJson(theme.name);
  const categories = Object.keys(themeJson.sounds);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-sounds-"));

  try {
    for (const cat of categories) mkdirp(path.join(SOUNDS_DIR, cat));

    const s = p.spinner();
    s.start(`Downloading ${theme.display}...`);
    downloadThemes([theme.name], tmpDir);
    s.stop(`Downloaded ${theme.display}.`);

    // Build selections: all native sounds per category
    const selections = {};
    for (const cat of categories) {
      selections[cat] = themeJson.sounds[cat].files.map((f) => ({
        themeName: theme.name,
        fileName: f.name,
        src: f.src,
      }));
    }

    const total = installSounds(selections, { [theme.name]: themeJson }, tmpDir);
    writeInstalled({ themes: [theme.name], mode: "quick" });
    installHooksConfig();

    p.log.success(`Installed ${total} sounds across ${categories.length} hooks.`);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ─── Custom Install ──────────────────────────────────────────────────────────

async function customInstall(selectedThemes) {
  const themeData = {};
  for (const theme of selectedThemes) {
    themeData[theme.name] = readThemeJson(theme.name);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-sounds-"));

  try {
    const s = p.spinner();
    s.start(`Downloading ${selectedThemes.length} theme${selectedThemes.length > 1 ? "s" : ""}...`);
    downloadThemes(selectedThemes.map((t) => t.name), tmpDir);
    s.stop(`Downloaded ${selectedThemes.length} theme${selectedThemes.length > 1 ? "s" : ""}.`);

    // Build rows (sound items + group headers)
    const rows = [];
    for (const theme of selectedThemes) {
      const themeJson = themeData[theme.name];
      rows.push({ type: 'header', theme: theme.name, label: theme.display });

      const seenFiles = new Set();
      for (const cat of Object.keys(themeJson.sounds)) {
        for (const file of themeJson.sounds[cat].files) {
          const key = `${theme.name}:${file.name}`;
          if (seenFiles.has(key)) continue;
          seenFiles.add(key);

          const srcPath = resolveDownloadSrc(tmpDir, themeJson.srcBase || theme.name, file.src);
          rows.push({
            type: 'sound',
            theme: theme.name,
            label: file.name.replace(/\.(wav|mp3)$/, ''),
            fileName: file.name,
            src: file.src,
            previewPath: fs.existsSync(srcPath) ? srcPath : undefined,
          });
        }
      }
    }

    // Build initial grid: pre-check each sound for its native hook(s)
    const soundOnlyRows = rows.filter(r => r.type === 'sound');
    const initialGrid = soundOnlyRows.map(soundRow => {
      return HOOKS.map(hook => {
        const themeJson = themeData[soundRow.theme];
        const catSounds = themeJson.sounds[hook.key];
        if (!catSounds) return false;
        return catSounds.files.some(f => f.name === soundRow.fileName);
      });
    });

    const gridResult = await new SoundGrid({
      message: 'Assign sounds to hooks',
      rows,
      hooks: HOOKS,
      initialGrid,
    }).prompt();

    killPreview();

    if (p.isCancel(gridResult)) {
      p.cancel("Cancelled.");
      process.exit(0);
    }

    // Convert grid result to selections format for installSounds()
    const selections = {};
    for (const hook of HOOKS) {
      const items = gridResult[hook.key];
      if (items && items.length > 0) {
        selections[hook.key] = items.map(item => {
          const themeJson = themeData[item.theme];
          let src = '';
          for (const cat of Object.keys(themeJson.sounds)) {
            const file = themeJson.sounds[cat].files.find(f => f.name === item.fileName);
            if (file) { src = file.src; break; }
          }
          return { themeName: item.theme, fileName: item.fileName, src };
        });
      }
    }

    for (const cat of Object.keys(selections)) {
      mkdirp(path.join(SOUNDS_DIR, cat));
    }

    const total = installSounds(selections, themeData, tmpDir);
    writeInstalled({ themes: selectedThemes.map((t) => t.name), mode: "custom" });
    installHooksConfig();

    printSummary(selections);
  } finally {
    killPreview();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ─── Reconfigure ─────────────────────────────────────────────────────────────

async function reconfigure(existingInstall) {
  const allThemes = listThemes();

  // Theme selection with current themes pre-checked
  const themeValues = await p.multiselect({
    message: "Select themes to include:",
    options: allThemes.map((t) => ({
      value: t.name,
      label: t.display,
      hint: `${t.soundCount} sounds — from ${t.sources.join(", ") || "local"}`,
    })),
    initialValues: existingInstall.themes,
    required: true,
  });

  if (p.isCancel(themeValues)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  const selectedThemes = allThemes.filter((t) => themeValues.includes(t.name));
  const themeData = {};
  for (const theme of selectedThemes) {
    themeData[theme.name] = readThemeJson(theme.name);
  }

  // Get currently installed files per category
  const currentFiles = {};
  for (const hook of HOOKS) {
    currentFiles[hook.key] = new Set();
    const catDir = path.join(SOUNDS_DIR, hook.key);
    try {
      for (const f of fs.readdirSync(catDir)) {
        if (f.endsWith(".wav") || f.endsWith(".mp3")) {
          currentFiles[hook.key].add(f);
        }
      }
    } catch {}
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "claude-sounds-"));

  try {
    // Split into already-installed vs new themes
    const installedSet = new Set(existingInstall.themes);
    const existingThemeNames = selectedThemes.filter(t => installedSet.has(t.name));
    const newThemeNames = selectedThemes.filter(t => !installedSet.has(t.name));

    // For already-installed themes, copy sounds from SOUNDS_DIR into tmpDir
    // so installSounds() can use them as source (it clears SOUNDS_DIR first)
    for (const theme of existingThemeNames) {
      const themeJson = themeData[theme.name];
      const srcBase = themeJson.srcBase || theme.name;
      for (const [cat, catData] of Object.entries(themeJson.sounds)) {
        for (const file of catData.files) {
          const installed = path.join(SOUNDS_DIR, cat, file.name);
          if (fs.existsSync(installed)) {
            const dest = resolveDownloadSrc(tmpDir, srcBase, file.src);
            mkdirp(path.dirname(dest));
            fs.copyFileSync(installed, dest);
          }
        }
      }
    }

    // Only download themes that aren't already installed
    if (newThemeNames.length > 0) {
      const s = p.spinner();
      const label = newThemeNames.length === 1
        ? newThemeNames[0].display
        : `${newThemeNames.length} new themes`;
      s.start(`Downloading ${label}...`);
      downloadThemes(newThemeNames.map((t) => t.name), tmpDir);
      s.stop(`Downloaded ${label}.`);
    }

    // Build rows
    const rows = [];
    for (const theme of selectedThemes) {
      const themeJson = themeData[theme.name];
      rows.push({ type: 'header', theme: theme.name, label: theme.display });

      const seenFiles = new Set();
      for (const cat of Object.keys(themeJson.sounds)) {
        for (const file of themeJson.sounds[cat].files) {
          const key = `${theme.name}:${file.name}`;
          if (seenFiles.has(key)) continue;
          seenFiles.add(key);

          const srcPath = resolveDownloadSrc(tmpDir, themeJson.srcBase || theme.name, file.src);
          rows.push({
            type: 'sound',
            theme: theme.name,
            label: file.name.replace(/\.(wav|mp3)$/, ''),
            fileName: file.name,
            src: file.src,
            previewPath: fs.existsSync(srcPath) ? srcPath : undefined,
          });
        }
      }
    }

    // Build initial grid from currently installed files
    const soundOnlyRows = rows.filter(r => r.type === 'sound');
    const initialGrid = soundOnlyRows.map(soundRow => {
      return HOOKS.map(hook => {
        return currentFiles[hook.key]?.has(soundRow.fileName) || false;
      });
    });

    const gridResult = await new SoundGrid({
      message: 'Assign sounds to hooks',
      rows,
      hooks: HOOKS,
      initialGrid,
    }).prompt();

    killPreview();

    if (p.isCancel(gridResult)) {
      p.cancel("Cancelled.");
      process.exit(0);
    }

    // Convert grid result to selections
    const selections = {};
    for (const hook of HOOKS) {
      const items = gridResult[hook.key];
      if (items && items.length > 0) {
        selections[hook.key] = items.map(item => {
          const themeJson = themeData[item.theme];
          let src = '';
          for (const cat of Object.keys(themeJson.sounds)) {
            const file = themeJson.sounds[cat].files.find(f => f.name === item.fileName);
            if (file) { src = file.src; break; }
          }
          return { themeName: item.theme, fileName: item.fileName, src };
        });
      }
    }

    for (const cat of Object.keys(selections)) {
      mkdirp(path.join(SOUNDS_DIR, cat));
    }

    const total = installSounds(selections, themeData, tmpDir);
    writeInstalled({ themes: selectedThemes.map((t) => t.name), mode: "custom" });
    installHooksConfig();

    printSummary(selections);
  } finally {
    killPreview();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  return true;
}

// ─── Interactive Install ─────────────────────────────────────────────────────

async function interactiveInstall(autoYes) {
  p.intro(color.bold("claude-code-sounds"));

  checkDependencies();

  const existing = detectExistingInstall();

  if (existing && !autoYes) {
    p.log.info(
      `Already installed — ${color.bold(existing.themeDisplays.join(", "))} (${existing.totalEnabled} sounds enabled)`
    );

    const action = await p.select({
      message: "What would you like to do?",
      options: [
        { value: "modify", label: "Modify install", hint: "Add themes, change sounds" },
        { value: "fresh", label: "Fresh install", hint: "Start over from scratch" },
        { value: "uninstall", label: "Uninstall", hint: "Remove all sounds and hooks" },
      ],
    });

    if (p.isCancel(action)) {
      p.cancel("Cancelled.");
      process.exit(0);
    }

    if (action === "uninstall") {
      uninstallAll();
      p.outro("All sounds removed.");
      return;
    }

    if (action === "modify") {
      const ok = await reconfigure(existing);
      if (ok) {
        p.outro("Start a new Claude Code session to hear it.");
        return;
      }
      // Fall through to fresh install if reconfigure failed
    }
    // "fresh" falls through
  }

  const themes = listThemes();
  if (themes.length === 0) {
    p.cancel("No themes found in themes/ directory.");
    process.exit(1);
  }

  // --yes: quick install first theme
  if (autoYes) {
    await quickInstall(themes[0]);
    p.outro("Start a new Claude Code session to hear it.");
    return;
  }

  const mode = await p.select({
    message: "How do you want to install?",
    options: [
      { value: "quick", label: "Quick install", hint: "One theme, all defaults" },
      { value: "custom", label: "Custom mix", hint: "Pick sounds from multiple themes" },
    ],
  });

  if (p.isCancel(mode)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  if (mode === "quick") {
    const themeValue = await p.select({
      message: "Select a theme:",
      options: themes.map((t) => ({
        value: t.name,
        label: t.display,
        hint: `${t.soundCount} sounds — ${t.description} [${t.sources.join(", ") || "local"}]`,
      })),
    });

    if (p.isCancel(themeValue)) {
      p.cancel("Cancelled.");
      process.exit(0);
    }

    await quickInstall(themes.find((t) => t.name === themeValue));
  } else {
    const themeValues = await p.multiselect({
      message: "Select themes to include:",
      options: themes.map((t) => ({
        value: t.name,
        label: t.display,
        hint: `${t.soundCount} sounds — from ${t.sources.join(", ") || "local"}`,
      })),
      required: true,
    });

    if (p.isCancel(themeValues)) {
      p.cancel("Cancelled.");
      process.exit(0);
    }

    await customInstall(themes.filter((t) => themeValues.includes(t.name)));
  }

  p.outro("Start a new Claude Code session to hear it.");
}

// ─── Main ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = new Set(args);
const autoYes = flags.has("--yes") || flags.has("-y");

if (flags.has("--help") || flags.has("-h")) {
  showHelp();
} else if (flags.has("--list") || flags.has("-l")) {
  showList();
} else if (flags.has("--uninstall") || flags.has("--remove")) {
  p.intro(color.bold("claude-code-sounds"));
  uninstallAll();
  p.outro("All sounds removed.");
} else {
  interactiveInstall(autoYes).catch((err) => {
    killPreview();
    p.cancel(err.message);
    process.exit(1);
  });
}
