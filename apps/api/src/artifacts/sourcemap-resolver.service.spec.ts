import { SourcemapResolverService } from "./sourcemap-resolver.service";

const sourceMap = Buffer.from(
  JSON.stringify({
    version: 3,
    file: "app.js",
    names: ["checkout"],
    sources: ["../src/checkout.ts"],
    sourcesContent: ["export function checkout() {}"],
    mappings: "AAAAA",
  }),
);

function artifact(name: string, storageKey = name) {
  return {
    id: `id-${name}`,
    organizationId: "organization-id",
    projectId: "project-id",
    releaseId: "release-id",
    name,
    contentType: "application/octet-stream",
    size: 1,
    checksum: "checksum",
    storageKey,
    createdAt: new Date(),
  };
}

function serviceWith(artifacts: ReturnType<typeof artifact>[], objects: Record<string, Buffer>) {
  const orderBy = jest.fn().mockResolvedValue(artifacts);
  const where = jest.fn().mockReturnValue({ orderBy });
  const from = jest.fn().mockReturnValue({ where });
  const db = { select: jest.fn().mockReturnValue({ from }) };
  const storage = {
    getObject: jest.fn(async (key: string) => {
      const object = objects[key];
      if (!object) throw new Error(`missing object ${key}`);
      return object;
    }),
  };
  return new SourcemapResolverService(db as never, storage as never);
}

describe("SourcemapResolverService", () => {
  it("matches complete URL paths and reports the original source and function", async () => {
    const service = serviceWith(
      [artifact("~/dist/assets/app.js"), artifact("~/dist/assets/app.js.map", "map")],
      { map: sourceMap },
    );

    await expect(
      service.resolveFrames({
        releaseId: "release-id",
        frames: [
          {
            filename: "https://cdn.example.test/dist/assets/app.js?v=42",
            function: "minified",
            lineno: 1,
            colno: 0,
          },
        ],
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        filename: "../src/checkout.ts",
        function: "checkout",
        lineno: 1,
        colno: 0,
        resolved: true,
        diagnostic: "resolved",
      }),
    ]);
  });

  it("uses abs_path and relative sourceMappingURL references without basename collisions", async () => {
    const service = serviceWith(
      [
        artifact("~/web/app.js", "web-js"),
        artifact("~/admin/app.js", "admin-js"),
        artifact("~/admin/maps/app.js.map", "admin-map"),
      ],
      {
        "admin-js": Buffer.from("minified\n//# sourceMappingURL=maps/app.js.map"),
        "admin-map": sourceMap,
      },
    );

    const [frame] = await service.resolveFrames({
      releaseId: "release-id",
      frames: [{ absPath: "https://cdn.example.test/admin/app.js", lineno: 1, colno: 0 }],
    });

    expect(frame).toEqual(expect.objectContaining({ resolved: true, diagnostic: "resolved" }));
  });

  it("does not guess when only an ambiguous basename is available", async () => {
    const service = serviceWith([artifact("~/web/app.js"), artifact("~/admin/app.js")], {});

    const [frame] = await service.resolveFrames({
      releaseId: "release-id",
      frames: [{ filename: "app.js", lineno: 1, colno: 0 }],
    });

    expect(frame).toEqual(
      expect.objectContaining({ resolved: false, diagnostic: "artifact_not_found" }),
    );
  });

  it("explains when a release is unavailable", async () => {
    const service = serviceWith([], {});
    const [frame] = await service.resolveFrames({
      releaseId: null,
      frames: [{ filename: "app.js", lineno: 1 }],
    });
    expect(frame.diagnostic).toBe("no_release");
  });

  it("keeps already readable frames for every non-browser SDK in the real matrix", async () => {
    const service = serviceWith([], {});
    const sdkNames = [
      "sentry.javascript.node",
      "sentry.python",
      "sentry.go",
      "sentry.java",
      "sentry.dotnet",
      "sentry.php",
      "sentry.ruby",
      "sentry.rust",
      "sentry.dart",
    ];

    for (const sdkName of sdkNames) {
      const [frame] = await service.resolveFrames({
        releaseId: "release-id",
        sdkName,
        frames: [{ filename: "src/probe", function: "main", lineno: 12 }],
      });
      expect(frame).toEqual(
        expect.objectContaining({
          filename: "src/probe",
          function: "main",
          lineno: 12,
          resolved: true,
          resolution: "original",
          diagnostic: "already_readable",
        }),
      );
    }
  });

  it("keeps browser frames unresolved when artifacts are missing", async () => {
    const service = serviceWith([], {});
    const [frame] = await service.resolveFrames({
      releaseId: "release-id",
      sdkName: "sentry.javascript.browser",
      frames: [{ filename: "https://cdn.example.test/app.js", function: "a", lineno: 1 }],
    });
    expect(frame).toEqual(
      expect.objectContaining({
        resolved: false,
        resolution: "sourcemap",
        diagnostic: "no_artifacts",
      }),
    );
  });

  it("deobfuscates Java classes, methods, and line numbers with a ProGuard mapping", async () => {
    const mapping = Buffer.from(
      ["com.example.CheckoutService -> a:", "    1:3:void submitOrder():41:43 -> b"].join("\n"),
    );
    const service = serviceWith([artifact("mapping.txt", "proguard")], {
      proguard: mapping,
    });

    const [frame] = await service.resolveFrames({
      releaseId: "release-id",
      sdkName: "sentry.java",
      frames: [{ module: "a", function: "b", lineno: 2 }],
    });

    expect(frame).toEqual(
      expect.objectContaining({
        filename: "CheckoutService.java",
        function: "com.example.CheckoutService.submitOrder",
        lineno: 42,
        resolved: true,
        resolution: "proguard",
      }),
    );
  });

  it("deobfuscates Dart names with an official name-pair map", async () => {
    const service = serviceWith([artifact("dart-obfuscation-map.json", "dart-map")], {
      "dart-map": Buffer.from(JSON.stringify(["CheckoutService", "a", "submitOrder", "b"])),
    });

    const [frame] = await service.resolveFrames({
      releaseId: "release-id",
      sdkName: "sentry.dart",
      frames: [{ module: "a", function: "a.b", filename: "package:app/main.dart", lineno: 18 }],
    });

    expect(frame).toEqual(
      expect.objectContaining({
        filename: "package:app/main.dart",
        function: "CheckoutService.submitOrder",
        lineno: 18,
        resolved: true,
        resolution: "dart_obfuscation",
      }),
    );
  });
});
