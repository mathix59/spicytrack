import { BadRequestException } from "@nestjs/common";

import { encodeCreatedAtCursor } from "../common/created-at-cursor";
import { DELIVERY_PAGE_SIZE, parseDeliveryQuery } from "./alerts-controller.utils";

describe("parseDeliveryQuery", () => {
  it("defaults to the first page of every status", () => {
    expect(parseDeliveryQuery({})).toEqual({
      limit: DELIVERY_PAGE_SIZE,
      cursor: undefined,
      status: undefined,
    });
  });

  it("reads the cursor, page size and status", () => {
    const cursor = {
      createdAt: "2026-11-04T10:00:00.123456Z",
      id: "0b8f5c1e-1d2a-4c3b-9e4f-5a6b7c8d9e0f",
    };
    expect(
      parseDeliveryQuery({ cursor: encodeCreatedAtCursor(cursor), limit: "10", status: "failed" }),
    ).toEqual({ limit: 10, cursor, status: "failed" });
  });

  it.each([
    { status: "lost" },
    { limit: "0" },
    { limit: "101" },
    { limit: "2.5" },
    { cursor: "x" },
  ])("rejects %j", (query) => {
    expect(() => parseDeliveryQuery(query)).toThrow(BadRequestException);
  });
});
