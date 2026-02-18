const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const lib = require("../bin/lib");

function makeTempPaths(t) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ccs-install-"));
  const claudeDir = path.join(tmpDir, ".claude");
  const pkgDir = path.resolve(__dirname, "..");
  const paths = lib.createPaths(claudeDir, pkgDir);
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));
  return { tmpDir, paths };
}

describe("installSounds", () => {
  it("copies files to category dirs", (t) => {
    const { paths } = makeTempPaths(t);
    const total = lib.installSounds(
      { start: [{ themeName: "wc3-peon", fileName: "ready-to-work.mp3" }] },
      paths
    );
    assert.equal(total, 1);
    assert.ok(fs.existsSync(path.join(paths.SOUNDS_DIR, "start", "ready-to-work.mp3")));
  });

  it("clears existing sounds before copying", (t) => {
    const { paths } = makeTempPaths(t);
    lib.installSounds(
      { start: [{ themeName: "wc3-peon", fileName: "ready-to-work.mp3" }] },
      paths
    );
    lib.installSounds(
      { start: [{ themeName: "wc3-peon", fileName: "something-need-doing.mp3" }] },
      paths
    );

    const files = fs.readdirSync(path.join(paths.SOUNDS_DIR, "start"));
    const soundFiles = files.filter((f) => f.endsWith(".wav") || f.endsWith(".mp3"));
    assert.equal(soundFiles.length, 1);
    assert.equal(soundFiles[0], "something-need-doing.mp3");
  });

  it("returns correct count for multiple categories", (t) => {
    const { paths } = makeTempPaths(t);
    const total = lib.installSounds(
      {
        start: [
          { themeName: "wc3-peon", fileName: "ready-to-work.mp3" },
          { themeName: "wc3-peon", fileName: "something-need-doing.mp3" },
        ],
        end: [{ themeName: "wc3-peon", fileName: "well-done.mp3" }],
      },
      paths
    );
    assert.equal(total, 3);
  });

  it("handles empty selections", (t) => {
    const { paths } = makeTempPaths(t);
    const total = lib.installSounds({}, paths);
    assert.equal(total, 0);
  });

  it("skips missing source files", (t) => {
    const { paths } = makeTempPaths(t);
    const total = lib.installSounds(
      { start: [{ themeName: "wc3-peon", fileName: "nonexistent.wav" }] },
      paths
    );
    assert.equal(total, 0);
  });
});

describe("installHooksConfig", () => {
  it("copies play-sound.sh", (t) => {
    const { paths } = makeTempPaths(t);
    lib.installHooksConfig(paths);
    assert.ok(fs.existsSync(path.join(paths.HOOKS_DIR, "play-sound.sh")));
  });

  it("sets executable permissions", (t) => {
    const { paths } = makeTempPaths(t);
    lib.installHooksConfig(paths);
    const stat = fs.statSync(path.join(paths.HOOKS_DIR, "play-sound.sh"));
    assert.ok(stat.mode & 0o111, "expected executable bit");
  });

  it("writes hooks to settings.json", (t) => {
    const { paths } = makeTempPaths(t);
    lib.installHooksConfig(paths);
    const settings = JSON.parse(fs.readFileSync(paths.SETTINGS_PATH, "utf-8"));
    assert.ok(settings.hooks);
    assert.ok(settings.hooks.SessionStart);
  });

  it("preserves existing settings keys", (t) => {
    const { paths } = makeTempPaths(t);
    lib.writeSettings({ existingKey: "value" }, paths);
    lib.installHooksConfig(paths);
    const settings = JSON.parse(fs.readFileSync(paths.SETTINGS_PATH, "utf-8"));
    assert.equal(settings.existingKey, "value");
    assert.ok(settings.hooks);
  });

  it("installs slash commands", (t) => {
    const { paths } = makeTempPaths(t);
    lib.installHooksConfig(paths);
    assert.ok(fs.existsSync(path.join(paths.COMMANDS_DIR, "mute.md")));
    assert.ok(fs.existsSync(path.join(paths.COMMANDS_DIR, "unmute.md")));
  });
});

describe("uninstallAll", () => {
  it("removes sounds directory", (t) => {
    const { paths } = makeTempPaths(t);
    fs.mkdirSync(paths.SOUNDS_DIR, { recursive: true });
    fs.writeFileSync(path.join(paths.SOUNDS_DIR, "test.wav"), "data");

    const removed = lib.uninstallAll(paths);
    assert.ok(removed.sounds);
    assert.ok(!fs.existsSync(paths.SOUNDS_DIR));
  });

  it("removes hooks script", (t) => {
    const { paths } = makeTempPaths(t);
    fs.mkdirSync(paths.HOOKS_DIR, { recursive: true });
    fs.writeFileSync(path.join(paths.HOOKS_DIR, "play-sound.sh"), "#!/bin/bash");

    const removed = lib.uninstallAll(paths);
    assert.ok(removed.hookScript);
    assert.ok(!fs.existsSync(path.join(paths.HOOKS_DIR, "play-sound.sh")));
  });

  it("removes hooks key from settings but preserves other keys", (t) => {
    const { paths } = makeTempPaths(t);
    lib.writeSettings({ hooks: lib.HOOKS_CONFIG, other: "keep" }, paths);

    const removed = lib.uninstallAll(paths);
    assert.ok(removed.hooksConfig);
    const settings = JSON.parse(fs.readFileSync(paths.SETTINGS_PATH, "utf-8"));
    assert.equal(settings.hooks, undefined);
    assert.equal(settings.other, "keep");
  });

  it("removes slash commands", (t) => {
    const { paths } = makeTempPaths(t);
    fs.mkdirSync(paths.COMMANDS_DIR, { recursive: true });
    fs.writeFileSync(path.join(paths.COMMANDS_DIR, "mute.md"), "test");
    fs.writeFileSync(path.join(paths.COMMANDS_DIR, "unmute.md"), "test");

    const removed = lib.uninstallAll(paths);
    assert.ok(removed.commands);
    assert.ok(!fs.existsSync(path.join(paths.COMMANDS_DIR, "mute.md")));
    assert.ok(!fs.existsSync(path.join(paths.COMMANDS_DIR, "unmute.md")));
  });

  it("handles missing state gracefully", (t) => {
    const { paths } = makeTempPaths(t);
    const removed = lib.uninstallAll(paths);
    assert.ok(!removed.sounds);
    assert.ok(!removed.hookScript);
    assert.ok(!removed.hooksConfig);
  });
});

describe("quickInstall", () => {
  it("installs sounds, hooks, and installed.json", (t) => {
    const { paths } = makeTempPaths(t);
    const themes = lib.listThemes(paths);
    const theme = themes.find((t) => t.name === "wc3-peon");

    const result = lib.quickInstall(theme, paths);

    assert.ok(result.total > 0);
    assert.equal(result.categories, 11);

    // Check installed.json
    const installed = lib.readInstalled(paths);
    assert.deepEqual(installed.themes, ["wc3-peon"]);
    assert.equal(installed.mode, "quick");

    // Check hooks config
    const settings = lib.readSettings(paths);
    assert.ok(settings.hooks);

    // Check play-sound.sh exists
    assert.ok(fs.existsSync(path.join(paths.HOOKS_DIR, "play-sound.sh")));

    // Check sound files exist
    assert.ok(fs.existsSync(path.join(paths.SOUNDS_DIR, "start")));
    const startFiles = fs.readdirSync(path.join(paths.SOUNDS_DIR, "start"));
    assert.ok(startFiles.length > 0);
  });

  it("uses fixture theme when available", (t) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ccs-qi-"));
    t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    const claudeDir = path.join(tmpDir, ".claude");
    const pkgDir = path.resolve(__dirname, "..");
    const paths = lib.createPaths(claudeDir, pkgDir);
    // Override THEMES_DIR to use fixtures
    paths.THEMES_DIR = path.resolve(__dirname, "fixtures", "themes");

    const themes = lib.listThemes(paths);
    const theme = themes.find((th) => th.name === "valid-theme");
    assert.ok(theme, "valid-theme fixture not found");

    const result = lib.quickInstall(theme, paths);
    assert.equal(result.total, 11); // 1 sound x 11 categories
    assert.equal(result.categories, 11);
  });
});
