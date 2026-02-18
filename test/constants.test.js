const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { HOOKS, HOOKS_CONFIG } = require("../bin/lib");

describe("HOOKS", () => {
  it("has exactly 11 entries", () => {
    assert.equal(HOOKS.length, 11);
  });

  it("contains all canonical hook keys", () => {
    const expected = new Set([
      "start", "end", "prompt", "stop", "permission",
      "idle", "subagent", "error", "task-completed",
      "compact", "teammate-idle",
    ]);
    const actual = new Set(HOOKS.map((h) => h.key));
    assert.deepEqual(actual, expected);
  });

  it("every entry has key, abbr, description", () => {
    for (const hook of HOOKS) {
      assert.ok(hook.key, "missing key");
      assert.ok(hook.abbr, `missing abbr for ${hook.key}`);
      assert.ok(hook.description, `missing description for ${hook.key}`);
    }
  });

  it("all abbr values are unique and 3 chars", () => {
    const abbrs = HOOKS.map((h) => h.abbr);
    assert.equal(new Set(abbrs).size, abbrs.length, "abbreviations not unique");
    for (const hook of HOOKS) {
      assert.equal(hook.abbr.length, 3, `${hook.key} abbr "${hook.abbr}" is not 3 chars`);
    }
  });
});

describe("HOOKS_CONFIG", () => {
  it("covers all lifecycle events", () => {
    const expected = new Set([
      "SessionStart", "SessionEnd", "Notification", "Stop",
      "SubagentStart", "PostToolUseFailure", "UserPromptSubmit",
      "TaskCompleted", "PreCompact", "TeammateIdle",
    ]);
    const actual = new Set(Object.keys(HOOKS_CONFIG));
    assert.deepEqual(actual, expected);
  });

  it("every command references play-sound.sh", () => {
    for (const [event, matchers] of Object.entries(HOOKS_CONFIG)) {
      for (const matcher of matchers) {
        for (const hook of matcher.hooks) {
          assert.ok(
            hook.command.includes("play-sound.sh"),
            `${event}: command missing play-sound.sh`
          );
        }
      }
    }
  });

  it("every hook has timeout 5", () => {
    for (const [event, matchers] of Object.entries(HOOKS_CONFIG)) {
      for (const matcher of matchers) {
        for (const hook of matcher.hooks) {
          assert.equal(hook.timeout, 5, `${event}: timeout is not 5`);
        }
      }
    }
  });
});
