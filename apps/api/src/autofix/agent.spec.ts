import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveInRepo, resolveWritableInRepo } from "./agent";

describe("autofix repository sandbox", () => {
  let workDir: string;
  let repoDir: string;
  let outsideFile: string;

  beforeEach(async () => {
    workDir = await realpath(await mkdtemp(path.join(tmpdir(), "autofix-agent-")));
    repoDir = path.join(workDir, "repo");
    outsideFile = path.join(workDir, "host-secret.env");
    await mkdir(path.join(repoDir, "src"), { recursive: true });
    await writeFile(path.join(repoDir, "src", "app.ts"), "export {};\n");
    await writeFile(outsideFile, "SECRET=1\n");
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it("resolves files inside the clone, including ones not created yet", async () => {
    await expect(resolveInRepo(repoDir, "src/app.ts")).resolves.toBe(
      path.join(repoDir, "src", "app.ts"),
    );
    await expect(resolveInRepo(repoDir, "src/new/file.ts")).resolves.toBe(
      path.join(repoDir, "src", "new", "file.ts"),
    );
  });

  it("rejects paths that leave the clone", async () => {
    await expect(resolveInRepo(repoDir, "../host-secret.env")).rejects.toThrow(
      "Path escapes the repository",
    );
    await expect(resolveInRepo(repoDir, outsideFile)).rejects.toThrow(
      "Path escapes the repository",
    );
  });

  it("follows symlinks before checking, so a committed link cannot expose host files", async () => {
    await symlink(outsideFile, path.join(repoDir, "config.env"));
    await symlink(workDir, path.join(repoDir, "linked-dir"));

    await expect(resolveInRepo(repoDir, "config.env")).rejects.toThrow(
      "Path escapes the repository",
    );
    await expect(resolveInRepo(repoDir, "linked-dir/host-secret.env")).rejects.toThrow(
      "Path escapes the repository",
    );
    await expect(resolveInRepo(repoDir, "linked-dir/new-file.ts")).rejects.toThrow(
      "Path escapes the repository",
    );
  });

  it("blocks .git", async () => {
    await expect(resolveInRepo(repoDir, ".git/config")).rejects.toThrow(
      "Access to .git is not allowed",
    );
  });

  it("refuses writes to CI configuration, hooks and lockfiles", async () => {
    for (const protectedPath of [
      ".github/workflows/ci.yml",
      ".gitlab-ci.yml",
      ".husky/pre-commit",
      "pnpm-lock.yaml",
      "apps/web/package-lock.json",
    ]) {
      await expect(resolveWritableInRepo(repoDir, protectedPath)).rejects.toThrow(
        "CI, hooks and lockfiles are protected",
      );
    }

    await expect(resolveWritableInRepo(repoDir, "./src/app.ts")).resolves.toEqual({
      absolute: path.join(repoDir, "src", "app.ts"),
      relative: "src/app.ts",
    });
  });
});
