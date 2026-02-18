const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { execSync } = require("child_process");
const path = require("path");
const os = require("os");

const CLI = path.resolve(__dirname, "..", "bin", "cli.js");
const isMacOS = os.platform() === "darwin";

function run(args) {
  try {
    const stdout = execSync(`node "${CLI}" ${args}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1" },
      timeout: 10000,
    });
    return { stdout, stderr: "", exitCode: 0 };
  } catch (err) {
    return {
      stdout: err.stdout || "",
      stderr: err.stderr || "",
      exitCode: err.status,
    };
  }
}

describe("--help", () => {
  it("exits 0", () => {
    const { exitCode } = run("--help");
    assert.equal(exitCode, 0);
  });

  it('output contains "claude-code-sounds"', () => {
    const { stdout } = run("--help");
    assert.ok(stdout.includes("claude-code-sounds"));
  });

  it("lists all flags", () => {
    const { stdout } = run("--help");
    for (const flag of ["--theme", "--mix", "--yes", "--list", "--help", "--uninstall"]) {
      assert.ok(stdout.includes(flag), `missing flag: ${flag}`);
    }
  });
});

describe("-h alias", () => {
  it("shows same help", () => {
    const { stdout, exitCode } = run("-h");
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("claude-code-sounds"));
  });
});

describe("--list", () => {
  it("exits 0", () => {
    const { exitCode } = run("--list");
    assert.equal(exitCode, 0);
  });

  it("lists theme names", () => {
    const { stdout } = run("--list");
    assert.ok(stdout.includes("wc3-peon"));
    assert.ok(stdout.includes("zelda-oot"));
  });

  it("shows sound counts", () => {
    const { stdout } = run("--list");
    assert.ok(/\d+ sounds/.test(stdout));
  });
});

describe("-l alias", () => {
  it("lists themes", () => {
    const { stdout, exitCode } = run("-l");
    assert.equal(exitCode, 0);
    assert.ok(stdout.includes("wc3-peon"));
  });
});

describe("--theme nonexistent", () => {
  it("exits non-zero", () => {
    const { exitCode } = run("--theme nonexistent");
    assert.ok(exitCode !== 0);
  });

  // On Linux, --theme exits early with "afplay" error before theme lookup
  it("mentions the theme name in output", { skip: !isMacOS && "requires afplay" }, () => {
    const { stdout, stderr } = run("--theme nonexistent");
    const output = stdout + stderr;
    assert.ok(output.includes("nonexistent"));
  });

  it("shows available themes", { skip: !isMacOS && "requires afplay" }, () => {
    const { stdout, stderr } = run("--theme nonexistent");
    const output = stdout + stderr;
    assert.ok(output.includes("Available") || output.includes("wc3-peon"));
  });
});

describe("--theme arg formats", { skip: !isMacOS && "requires afplay" }, () => {
  it("--theme badname parses theme name", () => {
    const { stdout, stderr } = run("--theme badname");
    const output = stdout + stderr;
    assert.ok(output.includes("badname"));
  });

  it("--theme=badname parses theme name", () => {
    const { stdout, stderr } = run("--theme=badname");
    const output = stdout + stderr;
    assert.ok(output.includes("badname"));
  });

  it("-t badname parses theme name", () => {
    const { stdout, stderr } = run("-t badname");
    const output = stdout + stderr;
    assert.ok(output.includes("badname"));
  });
});
