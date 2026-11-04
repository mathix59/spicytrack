import { BadRequestException } from "@nestjs/common";

import Fastify from "fastify";
import { auditRequestFrom, isPrivateAddress, trustProxySetting } from "../common/audit-request";
import {
  csvCell,
  decodeAuditCursor,
  encodeAuditCursor,
  parseAuditExportFormat,
  parseAuditFilters,
  parseAuditLimit,
  renderAuditExport,
} from "./audit-query";

const ID = "6c2b1f8e-3c7a-4d1e-9a51-2f4b8c9d0e1f";

describe("parseAuditFilters", () => {
  it("keeps the known filters and drops empty values", () => {
    expect(
      parseAuditFilters({
        action: "member.",
        actorUserId: ID,
        projectId: "",
        targetType: "api_key",
        from: "2026-01-01T00:00:00Z",
        unknown: "ignored",
      }),
    ).toEqual({
      action: "member.",
      actorUserId: ID,
      projectId: undefined,
      targetType: "api_key",
      from: new Date("2026-01-01T00:00:00Z"),
      to: undefined,
    });
  });

  it.each([
    [{ action: "member%" }],
    [{ actorUserId: "not-a-uuid" }],
    [{ from: "yesterday" }],
    [{ from: "2026-02-01", to: "2026-01-01" }],
    [{ targetType: ["a", "b"] }],
  ])("rejects %j", (query) => {
    expect(() => parseAuditFilters(query)).toThrow(BadRequestException);
  });
});

describe("audit pagination", () => {
  it("round-trips a microsecond cursor", () => {
    const cursor = { createdAt: "2026-11-03T10:00:00.123456Z", id: ID };
    expect(decodeAuditCursor(encodeAuditCursor(cursor))).toEqual(cursor);
  });

  it("rejects forged cursors and bad limits", () => {
    expect(() => decodeAuditCursor(Buffer.from("x|y").toString("base64url"))).toThrow(
      BadRequestException,
    );
    expect(() => parseAuditLimit("500")).toThrow(BadRequestException);
    expect(parseAuditLimit(undefined)).toBe(50);
  });
});

describe("audit export", () => {
  it("neutralises spreadsheet formulas and quotes separators", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell({ role: "admin" })).toBe('"{""role"":""admin""}"');
    expect(csvCell(null)).toBe("");
  });

  it("renders CSV with a header and a dated file name", () => {
    const file = renderAuditExport(
      [
        {
          createdAt: new Date("2026-11-03T10:00:00Z"),
          action: "member.removed",
          actorEmail: "a@example.test",
          actorName: null,
          actorTokenName: null,
          ipAddress: "203.0.113.4",
          userAgent: "curl/8",
          projectName: null,
          targetType: "member",
          targetId: ID,
          payload: {},
        },
      ],
      "csv",
      "acme",
      new Date("2026-11-03T12:00:00Z"),
    );
    expect(file.fileName).toBe("acme-audit-2026-11-03.csv");
    expect(file.body.split("\r\n")[1]).toBe(
      `2026-11-03T10:00:00.000Z,member.removed,a@example.test,,,203.0.113.4,curl/8,,member,${ID},{}`,
    );
    expect(parseAuditExportFormat("json")).toBe("json");
    expect(() => parseAuditExportFormat("xlsx")).toThrow(BadRequestException);
  });
});

describe("audit request context", () => {
  it("reads the IP and a bounded user agent", () => {
    expect(auditRequestFrom({ ip: "::1", headers: { "user-agent": "x".repeat(600) } })).toEqual({
      ipAddress: "::1",
      userAgent: "x".repeat(512),
    });
    expect(auditRequestFrom({ headers: {} })).toEqual({ ipAddress: null, userAgent: null });
  });

  it("parses TRUST_PROXY", () => {
    expect(trustProxySetting(undefined)).toBe(false);
    expect(trustProxySetting("true")).toBe(true);
    expect(typeof trustProxySetting("2")).toBe("function");
    expect(trustProxySetting("10.0.0.0/8, 127.0.0.1")).toEqual(["10.0.0.0/8", "127.0.0.1"]);
  });

  it("treats only loopback, private, CGNAT and link-local addresses as proxies", () => {
    for (const address of ["10.42.0.7", "172.18.0.5", "192.168.1.1", "127.0.0.1", "::1"]) {
      expect(isPrivateAddress(address)).toBe(true);
    }
    for (const address of ["100.64.0.1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(address)).toBe(true);
    }
    for (const address of ["203.0.113.9", "172.32.0.1", "2001:db8::1", "::ffff:8.8.8.8", "x"]) {
      expect(isPrivateAddress(address)).toBe(false);
    }
  });

  describe("client IP through Fastify", () => {
    const clientIp = async (
      trustProxy: string,
      remoteAddress: string,
      forwardedFor?: string,
    ): Promise<string> => {
      const app = Fastify({ trustProxy: trustProxySetting(trustProxy) });
      app.get("/", (request) => ({ ip: request.ip }));
      const response = await app.inject({
        url: "/",
        remoteAddress,
        headers: forwardedFor ? { "x-forwarded-for": forwardedFor } : {},
      });
      await app.close();
      return response.json().ip;
    };

    it("walks back as many private hops as configured", async () => {
      // Ingress controller, then the web pod's nginx: the client is two hops back.
      expect(await clientIp("2", "172.18.0.5", "6.6.6.6, 203.0.113.9, 10.42.0.7")).toBe(
        "203.0.113.9",
      );
      expect(await clientIp("1", "172.18.0.5", "6.6.6.6, 203.0.113.9")).toBe("203.0.113.9");
    });

    it("ignores X-Forwarded-For sent straight to the API from a public address", async () => {
      expect(await clientIp("2", "198.51.100.1", "6.6.6.6, 10.0.0.1")).toBe("198.51.100.1");
      expect(await clientIp("2", "172.18.0.5", "6.6.6.6, 198.51.100.1")).toBe("198.51.100.1");
    });

    it("trusts nothing when TRUST_PROXY is unset", async () => {
      expect(await clientIp("", "172.18.0.5", "203.0.113.9")).toBe("172.18.0.5");
    });
  });
});
