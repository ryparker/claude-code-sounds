const fs = require("fs");
const path = require("path");
const os = require("os");

// ─── Path Factory ────────────────────────────────────────────────────────────

function createPaths(claudeDir, pkgDir) {
  return {
    CLAUDE_DIR: claudeDir,
    SOUNDS_DIR: path.join(claudeDir, "sounds"),
    HOOKS_DIR: path.join(claudeDir, "hooks"),
    SETTINGS_PATH: path.join(claudeDir, "settings.json"),
    THEMES_DIR: path.join(pkgDir, "themes"),
    INSTALLED_PATH: path.join(claudeDir, "sounds", ".installed.json"),
    PKG_DIR: pkgDir,
  };
}

function defaultPaths() {
  return createPaths(
    path.join(os.homedir(), ".claude"),
    path.resolve(__dirname, "..")
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function listThemes(paths) {
  const themes = [];
  for (const name of fs.readdirSync(paths.THEMES_DIR)) {
    const themeJson = path.join(paths.THEMES_DIR, name, "theme.json");
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
      sources: meta.sources || [],
    });
  }
  return themes;
}

function readThemeJson(themeName, paths) {
  return JSON.parse(
    fs.readFileSync(path.join(paths.THEMES_DIR, themeName, "theme.json"), "utf-8")
  );
}

function resolveThemeSoundPath(themeName, fileName, paths) {
  return path.join(paths.THEMES_DIR, themeName, "sounds", fileName);
}

function readSettings(paths) {
  if (fs.existsSync(paths.SETTINGS_PATH)) {
    return JSON.parse(fs.readFileSync(paths.SETTINGS_PATH, "utf-8"));
  }
  return {};
}

function writeSettings(settings, paths) {
  mkdirp(paths.CLAUDE_DIR);
  fs.writeFileSync(paths.SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n");
}

function readInstalled(paths) {
  if (fs.existsSync(paths.INSTALLED_PATH)) {
    return JSON.parse(fs.readFileSync(paths.INSTALLED_PATH, "utf-8"));
  }
  return null;
}

function writeInstalled(data, paths) {
  mkdirp(paths.SOUNDS_DIR);
  fs.writeFileSync(paths.INSTALLED_PATH, JSON.stringify(data, null, 2) + "\n");
}

function isMuted(paths) {
  return fs.existsSync(path.join(paths.SOUNDS_DIR, ".muted"));
}

function setMuted(muted, paths) {
  const mutePath = path.join(paths.SOUNDS_DIR, ".muted");
  if (muted) {
    mkdirp(paths.SOUNDS_DIR);
    fs.writeFileSync(mutePath, "");
  } else if (fs.existsSync(mutePath)) {
    fs.unlinkSync(mutePath);
  }
}

// ─── Detect Existing Install ─────────────────────────────────────────────────

function detectExistingInstall(paths) {
  const installed = readInstalled(paths);
  if (!installed) return null;

  const themeNames = installed.themes || (installed.theme ? [installed.theme] : []);
  if (themeNames.length === 0) return null;

  let totalEnabled = 0;
  const allCategories = new Set();

  for (const themeName of themeNames) {
    try {
      const theme = readThemeJson(themeName, paths);
      for (const cat of Object.keys(theme.sounds)) {
        allCategories.add(cat);
      }
    } catch {}
  }

  for (const cat of allCategories) {
    const catDir = path.join(paths.SOUNDS_DIR, cat);
    try {
      for (const f of fs.readdirSync(catDir)) {
        if (f.endsWith(".wav") || f.endsWith(".mp3")) totalEnabled++;
      }
    } catch {}
  }

  if (totalEnabled === 0) return null;

  const displays = themeNames.map((n) => {
    try { return readThemeJson(n, paths).name; } catch { return n; }
  });

  return {
    themes: themeNames,
    themeDisplays: displays,
    totalEnabled,
    mode: installed.mode || "quick",
  };
}

// ─── Install Logic ───────────────────────────────────────────────────────────

function installSounds(selections, paths) {
  let total = 0;

  for (const [cat, items] of Object.entries(selections)) {
    const catDir = path.join(paths.SOUNDS_DIR, cat);
    mkdirp(catDir);

    try {
      for (const f of fs.readdirSync(catDir)) {
        if (f.endsWith(".wav") || f.endsWith(".mp3")) {
          fs.unlinkSync(path.join(catDir, f));
        }
      }
    } catch {}

    for (const item of items) {
      const srcPath = resolveThemeSoundPath(item.themeName, item.fileName, paths);
      const destPath = path.join(catDir, item.fileName);

      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        total++;
      }
    }
  }

  return total;
}

function installHooksConfig(paths) {
  mkdirp(paths.HOOKS_DIR);

  const hookSrc = path.join(paths.PKG_DIR, "hooks", "play-sound.sh");
  const hookDest = path.join(paths.HOOKS_DIR, "play-sound.sh");
  fs.copyFileSync(hookSrc, hookDest);
  fs.chmodSync(hookDest, 0o755);

  const settings = readSettings(paths);
  settings.hooks = HOOKS_CONFIG;
  writeSettings(settings, paths);
}

function uninstallAll(paths) {
  const removed = { sounds: false, hookScript: false, hooksConfig: false };

  if (fs.existsSync(paths.SOUNDS_DIR)) {
    fs.rmSync(paths.SOUNDS_DIR, { recursive: true });
    removed.sounds = true;
  }

  const hookScript = path.join(paths.HOOKS_DIR, "play-sound.sh");
  if (fs.existsSync(hookScript)) {
    fs.unlinkSync(hookScript);
    removed.hookScript = true;
  }

  if (fs.existsSync(paths.SETTINGS_PATH)) {
    const settings = readSettings(paths);
    delete settings.hooks;
    writeSettings(settings, paths);
    removed.hooksConfig = true;
  }

  return removed;
}

function quickInstall(theme, paths) {
  const themeJson = readThemeJson(theme.name, paths);
  const categories = Object.keys(themeJson.sounds);

  for (const cat of categories) mkdirp(path.join(paths.SOUNDS_DIR, cat));

  const selections = {};
  for (const cat of categories) {
    selections[cat] = themeJson.sounds[cat].files.map((f) => ({
      themeName: theme.name,
      fileName: f.name,
    }));
  }

  const total = installSounds(selections, paths);
  writeInstalled({ themes: [theme.name], mode: "quick" }, paths);
  installHooksConfig(paths);

  return { total, categories: categories.length };
}

module.exports = {
  createPaths,
  defaultPaths,
  HOOKS,
  HOOKS_CONFIG,
  mkdirp,
  listThemes,
  readThemeJson,
  resolveThemeSoundPath,
  readSettings,
  writeSettings,
  readInstalled,
  writeInstalled,
  isMuted,
  setMuted,
  detectExistingInstall,
  installSounds,
  installHooksConfig,
  uninstallAll,
  quickInstall,
};
