#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync, spawn } = require("child_process");
const p = require("@clack/prompts");
const { Prompt } = require("@clack/core");
const color = require("picocolors");

// ─── Library ─────────────────────────────────────────────────────────────────

const lib = require("./lib");
const paths = lib.defaultPaths();
const { HOOKS, mkdirp } = lib;
const { SOUNDS_DIR } = paths;

// Path-bound wrappers
const listThemes = () => lib.listThemes(paths);
const readThemeJson = (name) => lib.readThemeJson(name, paths);
const resolveThemeSoundPath = (name, file) => lib.resolveThemeSoundPath(name, file, paths);
const writeInstalled = (data) => lib.writeInstalled(data, paths);
const detectExistingInstall = () => lib.detectExistingInstall(paths);
const installSounds = (sel) => lib.installSounds(sel, paths);
const installHooksConfig = () => lib.installHooksConfig(paths);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hasCommand(name) {
  try {
    execFileSync("which", [name], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

// ─── Preview ─────────────────────────────────────────────────────────────────

let previewProcess = null;

function killPreview() {
  if (previewProcess) {
    try { previewProcess.kill("SIGKILL"); } catch {}
    previewProcess = null;
  }
}

function playPreview(filePath) {
  killPreview();
  if (fs.existsSync(filePath)) {
    const proc = spawn("afplay", [filePath], { stdio: "ignore" });
    previewProcess = proc;
    proc.on("exit", () => {
      if (previewProcess === proc) previewProcess = null;
    });
  }
}

// ─── Sound Grid Prompt ───────────────────────────────────────────────────────

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

// ─── Install / Uninstall ─────────────────────────────────────────────────────

async function quickInstall(theme) {
  const { total, categories } = lib.quickInstall(theme, paths);
  p.log.success(`Installed ${color.bold(theme.display)} — ${total} sounds across ${categories} hooks.`);
}

function uninstallAll() {
  const removed = lib.uninstallAll(paths);
  if (removed.sounds) p.log.step("Removed ~/.claude/sounds/");
  if (removed.hookScript) p.log.step("Removed ~/.claude/hooks/play-sound.sh");
  if (removed.hooksConfig) p.log.step("Removed hooks from settings.json");
  if (removed.commands) p.log.step("Removed /mute and /unmute commands");
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
    npx claude-code-sounds --theme mgs  Install a specific theme directly
    npx claude-code-sounds --mix        Jump straight to the sound grid
    npx claude-code-sounds --yes        Install defaults, skip prompts
    npx claude-code-sounds --list       List available themes
    npx claude-code-sounds --mute       Mute all sounds
    npx claude-code-sounds --unmute     Unmute all sounds
    npx claude-code-sounds --dnd        Auto-mute when in video calls
    npx claude-code-sounds --no-dnd     Disable auto-mute
    npx claude-code-sounds --uninstall  Remove all sounds and hooks
    npx claude-code-sounds --help       Show this help

  Flags:
    -t, --theme <name>  Install a specific theme by name
    -m, --mix           Jump to sound assignment grid
    -y, --yes           Skip all prompts, use defaults
    -l, --list          List available themes
        --mute          Mute all sounds
        --unmute        Unmute all sounds
        --dnd           Auto-mute when in video calls
        --no-dnd        Disable auto-mute
    -h, --help          Show this help
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

// ─── Check Dependencies ─────────────────────────────────────────────────────

function checkDependencies() {
  if (!hasCommand("afplay")) {
    p.cancel("afplay is not available. claude-code-sounds requires macOS.");
    process.exit(1);
  }
}

// ─── Custom Install ──────────────────────────────────────────────────────────

async function customInstall(selectedThemes) {
  const themeData = {};
  for (const theme of selectedThemes) {
    themeData[theme.name] = readThemeJson(theme.name);
  }

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

        const srcPath = resolveThemeSoundPath(theme.name, file.name);
        rows.push({
          type: 'sound',
          theme: theme.name,
          label: file.name.replace(/\.(wav|mp3)$/, ''),
          fileName: file.name,
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
      selections[hook.key] = items.map(item => ({
        themeName: item.theme,
        fileName: item.fileName,
      }));
    }
  }

  for (const cat of Object.keys(selections)) {
    mkdirp(path.join(SOUNDS_DIR, cat));
  }

  const total = installSounds(selections);
  writeInstalled({ themes: selectedThemes.map((t) => t.name), mode: "custom" });
  installHooksConfig();

  printSummary(selections);
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

        const srcPath = resolveThemeSoundPath(theme.name, file.name);
        rows.push({
          type: 'sound',
          theme: theme.name,
          label: file.name.replace(/\.(wav|mp3)$/, ''),
          fileName: file.name,
          previewPath: fs.existsSync(srcPath) ? srcPath : undefined,
        });
      }
    }
  }

  // Build initial grid: disk state for existing themes, theme.json defaults for new ones
  const existingThemeSet = new Set(existingInstall.themes);
  const soundOnlyRows = rows.filter(r => r.type === 'sound');
  const initialGrid = soundOnlyRows.map(soundRow => {
    const isNewTheme = !existingThemeSet.has(soundRow.theme);
    return HOOKS.map(hook => {
      if (isNewTheme) {
        const catSounds = themeData[soundRow.theme].sounds[hook.key];
        if (!catSounds) return false;
        return catSounds.files.some(f => f.name === soundRow.fileName);
      }
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
      selections[hook.key] = items.map(item => ({
        themeName: item.theme,
        fileName: item.fileName,
      }));
    }
  }

  for (const cat of Object.keys(selections)) {
    mkdirp(path.join(SOUNDS_DIR, cat));
  }

  const total = installSounds(selections);
  writeInstalled({ themes: selectedThemes.map((t) => t.name), mode: "custom" });
  installHooksConfig();

  printSummary(selections);

  return true;
}

// ─── Interactive Install ─────────────────────────────────────────────────────

async function interactiveInstall(autoYes) {
  p.intro(color.bold("claude-code-sounds"));

  checkDependencies();

  const existing = detectExistingInstall();

  if (existing && !autoYes) {
    const muted = lib.isMuted(paths);
    const muteStatus = muted ? color.yellow(" (muted)") : "";
    p.log.info(
      `Already installed — ${color.bold(existing.themeDisplays.join(", "))} (${existing.totalEnabled} sounds enabled)${muteStatus}`
    );

    const muteOption = muted
      ? { value: "unmute", label: "Unmute sounds", hint: "Sounds are currently muted" }
      : { value: "mute", label: "Mute sounds", hint: "Silence sounds without uninstalling" };

    const dnd = lib.isDnd(paths);
    const dndOption = dnd
      ? { value: "dnd-off", label: "Disable Do Not Disturb", hint: "Stop auto-muting during calls" }
      : { value: "dnd-on", label: "Enable Do Not Disturb", hint: "Auto-mute during video calls" };

    const action = await p.select({
      message: "What would you like to do?",
      options: [
        { value: "modify", label: "Modify install", hint: "Add themes, change sounds" },
        muteOption,
        dndOption,
        { value: "fresh", label: "Fresh install", hint: "Start over from scratch" },
        { value: "uninstall", label: "Uninstall", hint: "Remove all sounds and hooks" },
      ],
    });

    if (p.isCancel(action)) {
      p.cancel("Cancelled.");
      process.exit(0);
    }

    if (action === "mute") {
      lib.setMuted(true, paths);
      p.outro("Sounds muted.");
      return;
    }

    if (action === "unmute") {
      lib.setMuted(false, paths);
      p.outro("Sounds unmuted.");
      return;
    }

    if (action === "dnd-on") {
      lib.setDnd(true, paths);
      p.outro("Do Not Disturb enabled. Edit ~/.claude/sounds/.dnd to customize.");
      return;
    }

    if (action === "dnd-off") {
      lib.setDnd(false, paths);
      p.outro("Do Not Disturb disabled.");
      return;
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
    p.log.info(`To customize which sounds play on each hook, run:\n${color.gray(p.S_BAR)}\n${color.gray(p.S_BAR)}  ${color.cyan("npx claude-code-sounds")}\n${color.gray(p.S_BAR)}\n${color.gray(p.S_BAR)}  and choose ${color.bold("Modify install")}.`);
    p.outro("Start a new Claude Code session to hear it.");
    return;
  }

  const mode = await p.select({
    message: "How do you want to install?",
    options: [
      { value: "quick", label: "Quick install", hint: "One theme, all defaults" },
      { value: "custom", label: "Custom mix", hint: "Pick sounds per hook from multiple themes" },
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
    p.log.info(`To customize which sounds play on each hook, run:\n${color.gray(p.S_BAR)}\n${color.gray(p.S_BAR)}  ${color.cyan("npx claude-code-sounds")}\n${color.gray(p.S_BAR)}\n${color.gray(p.S_BAR)}  and choose ${color.bold("Modify install")}.`);
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

// Parse --theme <name> or --theme=<name> or -t <name>
let themeArg = null;
for (let i = 0; i < args.length; i++) {
  if ((args[i] === "--theme" || args[i] === "-t") && args[i + 1]) {
    themeArg = args[i + 1];
    break;
  }
  if (args[i].startsWith("--theme=")) {
    themeArg = args[i].slice("--theme=".length);
    break;
  }
}

if (flags.has("--help") || flags.has("-h")) {
  showHelp();
} else if (flags.has("--list") || flags.has("-l")) {
  showList();
} else if (themeArg) {
  (async () => {
    p.intro(color.bold("claude-code-sounds"));
    checkDependencies();

    const themes = listThemes();
    // Try exact match first, then case-insensitive
    let theme = themes.find((t) => t.name === themeArg);
    if (!theme) {
      const lower = themeArg.toLowerCase();
      theme = themes.find((t) => t.name.toLowerCase() === lower);
    }

    if (!theme) {
      p.cancel(
        `Theme "${themeArg}" not found.\n${color.gray(p.S_BAR)}\n${color.gray(p.S_BAR)}  Available: ${themes.map((t) => t.name).join(", ")}`
      );
      process.exit(1);
    }

    await quickInstall(theme);
    p.log.info(`To customize which sounds play on each hook, run:\n${color.gray(p.S_BAR)}\n${color.gray(p.S_BAR)}  ${color.cyan("npx claude-code-sounds")}\n${color.gray(p.S_BAR)}\n${color.gray(p.S_BAR)}  and choose ${color.bold("Modify install")}.`);
    p.outro("Start a new Claude Code session to hear it.");
  })().catch((err) => {
    killPreview();
    p.cancel(err.message);
    process.exit(1);
  });
} else if (flags.has("--mix") || flags.has("-m")) {
  (async () => {
    p.intro(color.bold("claude-code-sounds"));
    checkDependencies();

    const existing = detectExistingInstall();
    if (existing) {
      await reconfigure(existing);
    } else {
      const themes = listThemes();
      if (themes.length === 0) {
        p.cancel("No themes found in themes/ directory.");
        process.exit(1);
      }
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
  })().catch((err) => {
    killPreview();
    p.cancel(err.message);
    process.exit(1);
  });
} else if (flags.has("--mute")) {
  lib.setMuted(true, paths);
  console.log("  Sounds muted. Run --unmute to re-enable.");
} else if (flags.has("--unmute")) {
  lib.setMuted(false, paths);
  console.log("  Sounds unmuted.");
} else if (flags.has("--dnd")) {
  lib.setDnd(true, paths);
  console.log("  Do Not Disturb enabled. Sounds auto-mute when video call apps are detected.");
  console.log("  Edit ~/.claude/sounds/.dnd to customize the app list.");
} else if (flags.has("--no-dnd")) {
  lib.setDnd(false, paths);
  console.log("  Do Not Disturb disabled.");
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
