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
