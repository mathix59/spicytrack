import assert from "node:assert/strict";
import test from "node:test";
import {
  extractVersionSection,
  releaseVersionFromArgs,
  renderReleaseNotes,
} from "./render-release-notes.mjs";

const apiChangelog = `## 1.2.0

### Minor Changes

- Add API feature.

## 1.1.0

### Patch Changes

- Previous change.
`;

test("extractVersionSection selects only the requested version", () => {
  assert.equal(
    extractVersionSection(apiChangelog, "1.2.0"),
    "### Minor Changes\n\n- Add API feature.",
  );
});

test("renderReleaseNotes does not duplicate identical package notes", () => {
  const notes = renderReleaseNotes("1.2.0", [
    { name: "API", markdown: apiChangelog },
    { name: "Web", markdown: apiChangelog },
  ]);

  assert.equal(notes.match(/Add API feature/g)?.length, 1);
  assert.match(notes, /^# SpicyTrack 1\.2\.0/);
});

test("renderReleaseNotes labels different package notes", () => {
  const notes = renderReleaseNotes("1.2.0", [
    { name: "API", markdown: apiChangelog },
    {
      name: "Web",
      markdown: "## 1.2.0\n\n### Minor Changes\n\n- Add web feature.\n",
    },
  ]);

  assert.match(notes, /## API/);
  assert.match(notes, /## Web/);
  assert.match(notes, /Add web feature/);
});

test("releaseVersionFromArgs accepts pnpm's argument separator", () => {
  assert.equal(releaseVersionFromArgs(["--", "1.2.0"]), "1.2.0");
  assert.equal(releaseVersionFromArgs(["1.2.0"]), "1.2.0");
});
