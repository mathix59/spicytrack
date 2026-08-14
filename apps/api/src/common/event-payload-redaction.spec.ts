import { redactEventPayload } from "./event-payload-redaction";

describe("redactEventPayload", () => {
  it("redacts credentials in request headers, request data and query parameters", () => {
    expect(
      redactEventPayload({
        request: {
          headers: {
            Authorization: "Bearer top-secret",
            Cookie: "session=top-secret",
            Accept: "*/*",
          },
          data: { password: "top-secret" },
          url: "https://example.test/path?access_token=top-secret&limit=20",
        },
      }),
    ).toEqual({
      request: {
        headers: {
          Authorization: "[Filtered]",
          Cookie: "[Filtered]",
          Accept: "*/*",
        },
        data: "[Filtered]",
        url: "https://example.test/path?access_token=[Filtered]&limit=20",
      },
    });
  });
});
