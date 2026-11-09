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

/** In-memory stand-in for the resolved_stack_frames table, round-tripping frames through JSON. */
function memoryFrameStore() {
  const rows = new Map<string, string>();
  const rowKey = (releaseId: string, fingerprint: string, key: string) =>
    `${releaseId}|${fingerprint}|${key}`;
  return {
    rows,
    get: jest.fn(async (releaseId: string, fingerprint: string, keys: string[]) => {
      const found = new Map<string, unknown>();
      for (const key of keys) {
        const row = rows.get(rowKey(releaseId, fingerprint, key));
        if (row) found.set(key, JSON.parse(row));
      }
      return found;
    }),
    save: jest.fn(async (releaseId: string, fingerprint: string, frames: Map<string, object>) => {
      for (const [key, frame] of frames) {
        rows.set(rowKey(releaseId, fingerprint, key), JSON.stringify(frame));
      }
    }),
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
  return new SourcemapResolverService(db as never, storage as never, memoryFrameStore() as never);
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

  it("returns original Turbopack source context around the mapped line", async () => {
    const lines = [
      "export async function load() {",
      "  const url = '/api/data';",
      "  return fetch(url);",
      "}",
      "",
      "export default load;",
    ];
    const map = Buffer.from(
      JSON.stringify({
        version: 3,
        sources: ["turbopack:///[project]/src/load.ts"],
        sourcesContent: [lines.join("\n")],
        names: ["load"],
        mappings: "AAEAA",
      }),
    );
    const service = serviceWith([artifact(".next/static/chunks/app.js.map", "map")], { map });
    const [frame] = await service.resolveFrames({
      releaseId: "release-id",
      sdkName: "sentry.javascript.nextjs",
      frames: [{ filename: "https://app.test/_next/static/chunks/app.js", lineno: 1, colno: 500 }],
    });
    expect(frame).toMatchObject({
      filename: "src/load.ts",
      lineno: 3,
      colno: 0,
      contextLine: lines[2],
      preContext: lines.slice(0, 2),
      postContext: lines.slice(3, 6),
      resolved: true,
    });
  });

  it("keeps mapped positions when the source map omits source text", async () => {
    const map = Buffer.from(
      JSON.stringify({
        version: 3,
        sources: ["turbopack:///[project]/src/load.ts"],
        names: [],
        mappings: "AAAA",
      }),
    );
    const service = serviceWith([artifact("app.js.map", "map")], { map });
    const [frame] = await service.resolveFrames({
      releaseId: "release-id",
      frames: [{ filename: "app.js", lineno: 1, colno: 0 }],
    });
    expect(frame).toMatchObject({
      resolved: true,
      contextLine: null,
      preContext: [],
      postContext: [],
    });
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

  it("matches Next.js /_next URLs against artifacts uploaded from .next", async () => {
    const nextMap = Buffer.from(
      JSON.stringify({
        version: 3,
        file: "page-abc.js",
        names: ["Page"],
        sources: ["webpack://_N_E/./app/page.tsx"],
        sourcesContent: ["export default function Page() {}"],
        mappings: "AAAAA",
      }),
    );
    const service = serviceWith([artifact(".next/static/chunks/app/page-abc.js.map", "next-map")], {
      "next-map": nextMap,
    });

    const [frame] = await service.resolveFrames({
      releaseId: "release-id",
      sdkName: "sentry.javascript.nextjs",
      frames: [
        {
          filename: "https://shop.example.test/_next/static/chunks/app/page-abc.js",
          function: "a",
          lineno: 1,
          colno: 0,
        },
      ],
    });

    expect(frame).toEqual(
      expect.objectContaining({
        filename: "app/page.tsx",
        function: "Page",
        resolved: true,
        diagnostic: "resolved",
      }),
    );
  });

  it("resolves inline base64 maps emitted by webpack and esbuild", async () => {
    const inlineMap = Buffer.from(
      JSON.stringify({
        version: 3,
        file: "app.js",
        names: ["start"],
        sources: ["vite:///src/main.ts"],
        mappings: "AAAAA",
      }),
    ).toString("base64");
    const service = serviceWith([artifact("dist/assets/app.js", "bundle")], {
      bundle: Buffer.from(
        `minified();\n/*# sourceMappingURL=data:application/json;base64,${inlineMap} */`,
      ),
    });

    const [frame] = await service.resolveFrames({
      releaseId: "release-id",
      sdkName: "sentry.javascript.browser",
      frames: [{ filename: "/assets/app.js", lineno: 1, colno: 0 }],
    });

    expect(frame).toEqual(
      expect.objectContaining({
        filename: "src/main.ts",
        function: "start",
        resolved: true,
        diagnostic: "resolved",
      }),
    );
  });

  it.each([
    ["Vite", "dist/assets/app.js.map", "/assets/app.js"],
    ["Create React App", "build/static/js/main.js.map", "/static/js/main.js"],
    ["Nuxt", ".output/public/_nuxt/app.js.map", "/_nuxt/app.js"],
    ["SvelteKit", ".svelte-kit/output/client/_app/app.js.map", "/_app/app.js"],
    ["Angular", "dist/browser/main.js.map", "/main.js"],
  ])("matches %s build output paths", async (_framework, artifactName, frameName) => {
    const service = serviceWith([artifact(artifactName, "framework-map")], {
      "framework-map": sourceMap,
    });

    const [frame] = await service.resolveFrames({
      releaseId: "release-id",
      sdkName: "sentry.javascript.browser",
      frames: [{ filename: frameName, lineno: 1, colno: 0 }],
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

  describe("stored frames", () => {
    function cachedService(
      initial: ReturnType<typeof artifact>[],
      objects: Record<string, Buffer>,
      store = memoryFrameStore(),
    ) {
      let artifacts = initial;
      const orderBy = jest.fn(async () => artifacts);
      const db = {
        select: jest.fn(() => ({ from: () => ({ where: () => ({ orderBy }) }) })),
      };
      const getObject = jest.fn(async (key: string) => {
        const object = objects[key];
        if (!object) throw new Error(`missing object ${key}`);
        return object;
      });
      const service = new SourcemapResolverService(
        db as never,
        { getObject } as never,
        store as never,
      );
      return {
        service,
        getObject,
        store,
        setArtifacts: (next: typeof artifacts) => (artifacts = next),
      };
    }
    const frame = {
      filename: "https://cdn.example.test/app.js",
      function: "a",
      lineno: 1,
      colno: 0,
    };
    const resolve = (service: SourcemapResolverService, frames = [frame]) =>
      service.resolveFrames({
        releaseId: "release-id",
        sdkName: "sentry.javascript.nextjs",
        frames,
      });

    it("serves frames already resolved for the release without downloading the map again", async () => {
      const { service, getObject } = cachedService(
        [artifact("~/app.js"), artifact("~/app.js.map", "map")],
        { map: sourceMap },
      );

      const first = await resolve(service);
      const second = await resolve(service);

      expect(second).toEqual(first);
      expect(second[0]).toEqual(expect.objectContaining({ diagnostic: "resolved" }));
      expect(getObject).toHaveBeenCalledTimes(1);
    });

    it("resolves again once the release's artifacts change", async () => {
      const previousMap = Buffer.from(
        sourceMap.toString("utf8").replace("../src/checkout.ts", "../src/previous.ts"),
      );
      const { service, setArtifacts } = cachedService([artifact("~/app.js.map", "previous")], {
        previous: previousMap,
        map: sourceMap,
      });

      await expect(resolve(service)).resolves.toEqual([
        expect.objectContaining({ filename: "../src/previous.ts" }),
      ]);
      // Re-uploading a map under the same name stores it under a new key.
      setArtifacts([artifact("~/app.js.map", "map")]);

      await expect(resolve(service)).resolves.toEqual([
        expect.objectContaining({ filename: "../src/checkout.ts" }),
      ]);
    });

    it("retries frames whose source map could not be read", async () => {
      const objects: Record<string, Buffer> = {};
      const { service, getObject } = cachedService(
        [artifact("~/app.js"), artifact("~/app.js.map", "map")],
        objects,
      );

      await expect(resolve(service)).resolves.toEqual([
        expect.objectContaining({ diagnostic: "invalid_sourcemap" }),
      ]);
      objects.map = sourceMap;

      await expect(resolve(service)).resolves.toEqual([
        expect.objectContaining({ diagnostic: "resolved" }),
      ]);
      expect(getObject).toHaveBeenCalledTimes(2);
    });

    it("downloads each source map once for frames of the same chunk", async () => {
      const { service, getObject } = cachedService(
        [artifact("~/app.js"), artifact("~/app.js.map", "map")],
        { map: sourceMap },
      );
      const frames = Array.from({ length: 12 }, (_, index) => ({
        ...frame,
        function: `f${index}`,
      }));

      const resolved = await resolve(service, frames);

      expect(resolved).toHaveLength(12);
      expect(resolved.map((item) => item.function)).toEqual(Array(12).fill("checkout"));
      expect(getObject).toHaveBeenCalledTimes(1);
    });

    it("still resolves frames when the stored frames cannot be read or written", async () => {
      const store = memoryFrameStore();
      store.get.mockRejectedValue(new Error("database unavailable"));
      store.save.mockRejectedValue(new Error("database unavailable"));
      const { service } = cachedService(
        [artifact("~/app.js"), artifact("~/app.js.map", "map")],
        { map: sourceMap },
        store,
      );

      await expect(resolve(service)).resolves.toEqual([
        expect.objectContaining({ filename: "../src/checkout.ts", diagnostic: "resolved" }),
      ]);
    });

    it("stores nothing for releases without artifacts", async () => {
      const { service, store } = cachedService([], {});

      await resolve(service);

      expect(store.get).not.toHaveBeenCalled();
      expect(store.save).not.toHaveBeenCalled();
    });
  });
});
