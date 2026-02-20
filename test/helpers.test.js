const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const lib = require("../bin/lib");

function makeTempPaths(t) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ccs-test-"));
  const claudeDir = path.join(tmpDir, ".claude");
  const pkgDir = path.resolve(__dirname, "..");
  const paths = lib.createPaths(claudeDir, pkgDir);
  t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));
  return { tmpDir, paths };
}

describe("resolveThemeSoundPath", () => {
  it("returns correct path", (t) => {
    const { paths } = makeTempPaths(t);
    const result = lib.resolveThemeSoundPath("my-theme", "sound.wav", paths);
    assert.equal(
      result,
      path.join(paths.THEMES_DIR, "my-theme", "sounds", "sound.wav")
    );
  });
});

describe("readSettings / writeSettings", () => {
  it("round-trips JSON", (t) => {
    const { paths } = makeTempPaths(t);
    const data = { foo: "bar", num: 42 };
    lib.writeSettings(data, paths);
    assert.deepEqual(lib.readSettings(paths), data);
  });

  it("creates parent directories", (t) => {
    const { paths } = makeTempPaths(t);
    assert.ok(!fs.existsSync(paths.CLAUDE_DIR));
    lib.writeSettings({ test: true }, paths);
    assert.ok(fs.existsSync(paths.SETTINGS_PATH));
  });

  it("returns empty object when file missing", (t) => {
    const { paths } = makeTempPaths(t);
    assert.deepEqual(lib.readSettings(paths), {});
  });

  it("returns empty object when file is corrupted", (t) => {
    const { paths } = makeTempPaths(t);
    lib.mkdirp(paths.CLAUDE_DIR);
    fs.writeFileSync(paths.SETTINGS_PATH, "NOT VALID JSON{{{");
    assert.deepEqual(lib.readSettings(paths), {});
  });
});

describe("readInstalled / writeInstalled", () => {
  it("round-trips JSON", (t) => {
    const { paths } = makeTempPaths(t);
    const data = { themes: ["wc3-peon"], mode: "quick" };
    lib.writeInstalled(data, paths);
    assert.deepEqual(lib.readInstalled(paths), data);
  });

  it("returns null when file missing", (t) => {
    const { paths } = makeTempPaths(t);
    assert.equal(lib.readInstalled(paths), null);
  });

  it("handles old format { theme }", (t) => {
    const { paths } = makeTempPaths(t);
    lib.writeInstalled({ theme: "wc3-peon" }, paths);
    const result = lib.readInstalled(paths);
    assert.equal(result.theme, "wc3-peon");
  });

  it("handles new format { themes, mode }", (t) => {
    const { paths } = makeTempPaths(t);
    const data = { themes: ["wc3-peon", "zelda-oot"], mode: "custom" };
    lib.writeInstalled(data, paths);
    const result = lib.readInstalled(paths);
    assert.deepEqual(result.themes, ["wc3-peon", "zelda-oot"]);
    assert.equal(result.mode, "custom");
  });

  it("returns null when file is corrupted", (t) => {
    const { paths } = makeTempPaths(t);
    lib.mkdirp(paths.SOUNDS_DIR);
    fs.writeFileSync(paths.INSTALLED_PATH, "CORRUPTED{{{");
    assert.equal(lib.readInstalled(paths), null);
  });
});

describe("listThemes", () => {
  it("returns correct shape for real themes", (t) => {
    const { paths } = makeTempPaths(t);
    const themes = lib.listThemes(paths);
    assert.ok(themes.length > 0, "expected at least one theme");
    for (const theme of themes) {
      assert.ok(theme.name, "missing name");
      assert.ok(typeof theme.description === "string");
      assert.ok(typeof theme.display === "string");
      assert.ok(typeof theme.soundCount === "number");
      assert.ok(theme.soundCount > 0, `${theme.name}: expected sounds`);
      assert.ok(Array.isArray(theme.sources));
    }
  });

  it("skips dirs without theme.json", (t) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ccs-themes-"));
    t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    fs.mkdirSync(path.join(tmpDir, "themes", "good"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "themes", "good", "theme.json"),
      JSON.stringify({ name: "Good", description: "test", sounds: {} })
    );
    fs.mkdirSync(path.join(tmpDir, "themes", "bad"), { recursive: true });
    // no theme.json in 'bad'

    const customPaths = lib.createPaths(path.join(tmpDir, ".claude"), tmpDir);
    const themes = lib.listThemes(customPaths);
    assert.equal(themes.length, 1);
    assert.equal(themes[0].name, "good");
  });

  it("skips corrupted theme.json", (t) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ccs-themes-"));
    t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    fs.mkdirSync(path.join(tmpDir, "themes", "good"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "themes", "good", "theme.json"),
      JSON.stringify({ name: "Good", description: "test", sounds: {} })
    );
    fs.mkdirSync(path.join(tmpDir, "themes", "corrupt"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "themes", "corrupt", "theme.json"),
      "NOT VALID JSON{{{"
    );

    const customPaths = lib.createPaths(path.join(tmpDir, ".claude"), tmpDir);
    const themes = lib.listThemes(customPaths);
    assert.equal(themes.length, 1);
    assert.equal(themes[0].name, "good");
  });

  it("counts sounds correctly", (t) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ccs-themes-"));
    t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

    fs.mkdirSync(path.join(tmpDir, "themes", "counted"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, "themes", "counted", "theme.json"),
      JSON.stringify({
        name: "Counted",
        description: "test",
        sounds: {
          start: { description: "s", files: [{ name: "a.wav" }, { name: "b.wav" }] },
          end: { description: "e", files: [{ name: "c.wav" }] },
        },
      })
    );

    const customPaths = lib.createPaths(path.join(tmpDir, ".claude"), tmpDir);
    const themes = lib.listThemes(customPaths);
    assert.equal(themes[0].soundCount, 3);
  });
});

describe("detectExistingInstall", () => {
  it("returns null when no installed file", (t) => {
    const { paths } = makeTempPaths(t);
    assert.equal(lib.detectExistingInstall(paths), null);
  });

  it("handles old format { theme }", (t) => {
    const { paths } = makeTempPaths(t);
    lib.writeInstalled({ theme: "wc3-peon" }, paths);
    // Create a sound file so totalEnabled > 0
    const catDir = path.join(paths.SOUNDS_DIR, "start");
    fs.mkdirSync(catDir, { recursive: true });
    fs.writeFileSync(path.join(catDir, "test.wav"), "fake");

    const result = lib.detectExistingInstall(paths);
    assert.ok(result);
    assert.deepEqual(result.themes, ["wc3-peon"]);
    assert.ok(result.totalEnabled > 0);
  });

  it("handles new format { themes, mode }", (t) => {
    const { paths } = makeTempPaths(t);
    lib.writeInstalled({ themes: ["wc3-peon"], mode: "custom" }, paths);
    const catDir = path.join(paths.SOUNDS_DIR, "start");
    fs.mkdirSync(catDir, { recursive: true });
    fs.writeFileSync(path.join(catDir, "test.wav"), "fake");

    const result = lib.detectExistingInstall(paths);
    assert.ok(result);
    assert.deepEqual(result.themes, ["wc3-peon"]);
    assert.equal(result.mode, "custom");
  });

  it("returns correct totalEnabled count", (t) => {
    const { paths } = makeTempPaths(t);
    lib.writeInstalled({ themes: ["wc3-peon"], mode: "quick" }, paths);

    for (const cat of ["start", "end"]) {
      fs.mkdirSync(path.join(paths.SOUNDS_DIR, cat), { recursive: true });
    }
    fs.writeFileSync(path.join(paths.SOUNDS_DIR, "start", "a.wav"), "fake");
    fs.writeFileSync(path.join(paths.SOUNDS_DIR, "start", "b.mp3"), "fake");
    fs.writeFileSync(path.join(paths.SOUNDS_DIR, "end", "c.wav"), "fake");

    const result = lib.detectExistingInstall(paths);
    assert.equal(result.totalEnabled, 3);
  });

  it("returns null when no sound files on disk", (t) => {
    const { paths } = makeTempPaths(t);
    lib.writeInstalled({ themes: ["wc3-peon"], mode: "quick" }, paths);
    // installed.json exists but no actual sound files
    assert.equal(lib.detectExistingInstall(paths), null);
  });
});

describe("isMuted / setMuted", () => {
  it("returns false when not muted", (t) => {
    const { paths } = makeTempPaths(t);
    assert.equal(lib.isMuted(paths), false);
  });

  it("mutes and unmutes", (t) => {
    const { paths } = makeTempPaths(t);
    lib.setMuted(true, paths);
    assert.equal(lib.isMuted(paths), true);
    lib.setMuted(false, paths);
    assert.equal(lib.isMuted(paths), false);
  });

  it("creates sounds dir when muting", (t) => {
    const { paths } = makeTempPaths(t);
    assert.ok(!fs.existsSync(paths.SOUNDS_DIR));
    lib.setMuted(true, paths);
    assert.ok(fs.existsSync(paths.SOUNDS_DIR));
  });

  it("unmute is safe when not muted", (t) => {
    const { paths } = makeTempPaths(t);
    lib.setMuted(false, paths); // should not throw
    assert.equal(lib.isMuted(paths), false);
  });
});

describe("atomic writes", () => {
  it("leaves no .tmp files after writeSettings", (t) => {
    const { paths } = makeTempPaths(t);
    lib.writeSettings({ test: true }, paths);
    assert.ok(!fs.existsSync(paths.SETTINGS_PATH + ".tmp"));
    assert.ok(fs.existsSync(paths.SETTINGS_PATH));
  });

  it("leaves no .tmp files after writeInstalled", (t) => {
    const { paths } = makeTempPaths(t);
    lib.writeInstalled({ themes: ["test"] }, paths);
    assert.ok(!fs.existsSync(paths.INSTALLED_PATH + ".tmp"));
    assert.ok(fs.existsSync(paths.INSTALLED_PATH));
  });
});

describe("isDnd / setDnd", () => {
  it("returns false when not enabled", (t) => {
    const { paths } = makeTempPaths(t);
    assert.equal(lib.isDnd(paths), false);
  });

  it("enables and disables", (t) => {
    const { paths } = makeTempPaths(t);
    lib.setDnd(true, paths);
    assert.equal(lib.isDnd(paths), true);
    lib.setDnd(false, paths);
    assert.equal(lib.isDnd(paths), false);
  });

  it("creates sounds dir when enabling", (t) => {
    const { paths } = makeTempPaths(t);
    assert.ok(!fs.existsSync(paths.SOUNDS_DIR));
    lib.setDnd(true, paths);
    assert.ok(fs.existsSync(paths.SOUNDS_DIR));
  });

  it("disable is safe when not enabled", (t) => {
    const { paths } = makeTempPaths(t);
    lib.setDnd(false, paths); // should not throw
    assert.equal(lib.isDnd(paths), false);
  });

  it(".dnd file contains DND_DEFAULTS content", (t) => {
    const { paths } = makeTempPaths(t);
    lib.setDnd(true, paths);
    const content = fs.readFileSync(path.join(paths.SOUNDS_DIR, ".dnd"), "utf-8");
    assert.equal(content, lib.DND_DEFAULTS.join("\n") + "\n");
  });
});

describe("DND_DEFAULTS", () => {
  it("is a non-empty array of strings", () => {
    assert.ok(Array.isArray(lib.DND_DEFAULTS));
    assert.ok(lib.DND_DEFAULTS.length > 0);
    for (const entry of lib.DND_DEFAULTS) {
      assert.equal(typeof entry, "string");
    }
  });

  it("contains expected process names", () => {
    const joined = lib.DND_DEFAULTS.join("\n");
    assert.ok(joined.includes("CptHost"), "missing CptHost");
    assert.ok(joined.includes("FaceTime"), "missing FaceTime");
  });
});
