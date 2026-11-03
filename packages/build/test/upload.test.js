import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { discoverArtifacts } from "../src/files.js";
import { uploadSourceMaps } from "../src/upload.js";

async function buildFixture() {
  const cwd = await mkdtemp(path.join(tmpdir(), "spicytrack-upload-"));
  await mkdir(path.join(cwd, ".next/static/chunks/app"), { recursive: true });
  await writeFile(path.join(cwd, ".next/static/chunks/app/page.js"), "minified");
  await writeFile(path.join(cwd, ".next/static/chunks/app/page.js.map"), '{"version":3}');
  await writeFile(path.join(cwd, ".next/static/chunks/app/ignore.css"), "body{}");
  return cwd;
}

test("preserves framework build paths and includes only JavaScript artifacts", async () => {
  const cwd = await buildFixture();
  const artifacts = await discoverArtifacts(cwd, [".next"]);
  assert.deepEqual(
    artifacts.map((artifact) => artifact.artifactName),
    [".next/static/chunks/app/page.js", ".next/static/chunks/app/page.js.map"],
  );
});

test("creates a release then uploads every artifact with bearer authentication", async () => {
  const cwd = await buildFixture();
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    requests.push({
      method: init.method,
      url: String(url),
      auth: init.headers.authorization,
      body: typeof init.body === "string" ? init.body : null,
    });
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const result = await uploadSourceMaps({
      cwd,
      url: "https://spicytrack.example.test",
      organization: "acme",
      project: "storefront",
      token: "pat_secret",
      release: "release-123",
      commitSha: "ABCDEF1234567",
      roots: [".next"],
      concurrency: 1,
    });
    assert.equal(result.artifacts.length, 2);
    assert.equal(requests[0].method, "PUT");
    assert.deepEqual(JSON.parse(requests[0].body), { commitSha: "abcdef1234567" });
    assert.equal(requests[0].auth, "Bearer pat_secret");
    assert.equal(
      requests.slice(1).every((request) => request.method === "POST"),
      true,
    );
    assert.equal(
      requests.some((request) =>
        request.url.includes("artifactName=.next%2Fstatic%2Fchunks%2Fapp%2Fpage.js.map"),
      ),
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("resolves the commit SHA from SpicyTrack, then CI, then Git", async () => {
  const { resolveCommitSha } = await import("../src/config.js");
  const saved = { ...process.env };
  try {
    delete process.env.SPICYTRACK_COMMIT_SHA;
    process.env.GITHUB_SHA = "1111111111111111111111111111111111111111";
    assert.equal(resolveCommitSha({}), "1111111111111111111111111111111111111111");
    assert.equal(resolveCommitSha({ commitSha: "2222222" }), "2222222");
    process.env.SPICYTRACK_COMMIT_SHA = "3333333";
    assert.equal(resolveCommitSha({ commitSha: "2222222" }), "3333333");
    process.env.SPICYTRACK_COMMIT_SHA = "not-a-sha";
    assert.equal(resolveCommitSha({}), null);
  } finally {
    process.env = saved;
  }
});
