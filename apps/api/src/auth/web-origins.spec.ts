import { webOrigins } from "./web-origins";

describe("webOrigins", () => {
  const originalWebOrigin = process.env.WEB_ORIGIN;
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (originalWebOrigin === undefined) delete process.env.WEB_ORIGIN;
    else process.env.WEB_ORIGIN = originalWebOrigin;

    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it("accepts the common loopback aliases in development", () => {
    process.env.NODE_ENV = "development";
    process.env.WEB_ORIGIN = "http://localhost:5174";

    expect(webOrigins()).toEqual([
      "http://localhost:5174",
      "http://127.0.0.1:5174",
      "http://[::1]:5174",
    ]);
  });

  it("keeps production origins exact", () => {
    process.env.NODE_ENV = "production";
    process.env.WEB_ORIGIN = "https://spicytrack.example, https://admin.example/";

    expect(webOrigins()).toEqual(["https://spicytrack.example", "https://admin.example"]);
  });
});
