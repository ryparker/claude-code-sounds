const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const THEMES_DIR = path.resolve(__dirname, "..", "themes");

const REQUIRED_CATEGORIES = [
  "start", "end", "prompt", "stop", "permission",
  "idle", "subagent", "error", "task-completed",
  "compact", "teammate-idle",
];

const themeDirs = fs.readdirSync(THEMES_DIR).filter((name) => {
  return fs.existsSync(path.join(THEMES_DIR, name, "theme.json"));
});

describe("themes", () => {
  const allNames = [];

  for (const themeName of themeDirs) {
    describe(themeName, () => {
      const themeFile = path.join(THEMES_DIR, themeName, "theme.json");
      let data;

      function loadData() {
        if (!data) data = JSON.parse(fs.readFileSync(themeFile, "utf-8"));
        return data;
      }

      it("has valid JSON with required fields", () => {
        const d = loadData();
        assert.ok(d.name, "missing name");
        assert.ok(d.description, "missing description");
        assert.ok(d.sounds, "missing sounds");
      });

      it("has all 11 categories", () => {
        const d = loadData();
        for (const cat of REQUIRED_CATEGORIES) {
          assert.ok(d.sounds[cat], `missing category: ${cat}`);
        }
      });

      it("each category has description and non-empty files", () => {
        const d = loadData();
        for (const [cat, val] of Object.entries(d.sounds)) {
          assert.ok(val.description, `${cat}: missing description`);
          assert.ok(Array.isArray(val.files), `${cat}: files is not an array`);
          assert.ok(val.files.length > 0, `${cat}: files is empty`);
        }
      });

      it("every file has .wav or .mp3 extension", () => {
        const d = loadData();
        for (const [cat, val] of Object.entries(d.sounds)) {
          for (const f of val.files) {
            assert.ok(f.name, `${cat}: file missing name`);
            assert.match(f.name, /\.(wav|mp3)$/, `${cat}: ${f.name} has invalid extension`);
          }
        }
      });

      it("no duplicate filenames within a category", () => {
        const d = loadData();
        for (const [cat, val] of Object.entries(d.sounds)) {
          const names = val.files.map((f) => f.name);
          assert.equal(new Set(names).size, names.length, `${cat}: duplicate filenames`);
        }
      });

      it("every referenced sound file exists on disk with size > 0", () => {
        const d = loadData();
        for (const [cat, val] of Object.entries(d.sounds)) {
          for (const f of val.files) {
            const soundPath = path.join(THEMES_DIR, themeName, "sounds", f.name);
            assert.ok(fs.existsSync(soundPath), `${cat}: ${f.name} not found`);
            const stat = fs.statSync(soundPath);
            assert.ok(stat.size > 0, `${cat}: ${f.name} is empty`);
          }
        }
      });
    });

    try {
      const d = JSON.parse(
        fs.readFileSync(path.join(THEMES_DIR, themeName, "theme.json"), "utf-8")
      );
      allNames.push({ dir: themeName, display: d.name });
    } catch {}
  }

  it("no duplicate display names across themes", () => {
    const displays = allNames.map((t) => t.display);
    const dupes = displays.filter((name, i) => displays.indexOf(name) !== i);
    assert.equal(dupes.length, 0, `duplicate display names: ${dupes.join(", ")}`);
  });
});
