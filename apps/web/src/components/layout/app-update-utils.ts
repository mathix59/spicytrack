function versionParts(version: string) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version);
  if (!match) return null;
  return {
    numbers: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ?? null,
  };
}

export function isVersionNewer(candidate: string, current: string) {
  const next = versionParts(candidate);
  const installed = versionParts(current);
  if (!next || !installed) return false;
  for (let index = 0; index < next.numbers.length; index += 1) {
    if (next.numbers[index] !== installed.numbers[index]) {
      return next.numbers[index]! > installed.numbers[index]!;
    }
  }
  return installed.prerelease !== null && next.prerelease === null;
}
