import { boundGroupingKey, computeGroupingKey, computeLegacyGroupingKey } from "../common/grouping";
import { InvalidEnvelopeError, parseEnvelopeEvent } from "./ingest.utils";

const header = JSON.stringify({ event_id: "abc", dsn: "https://key@example.com/1" });

describe("parseEnvelopeEvent", () => {
  it("returns the event item", () => {
    const envelope = [header, JSON.stringify({ type: "event" }), JSON.stringify({ message: "x" })];

    expect(parseEnvelopeEvent(envelope.join("\n"))).toEqual({ message: "x" });
  });

  it("returns null for envelopes without an event item", () => {
    const envelope = [header, JSON.stringify({ type: "session" }), JSON.stringify({ sid: "1" })];

    expect(parseEnvelopeEvent(envelope.join("\n"))).toBeNull();
  });

  it("rejects an event item that is not a JSON object instead of crashing", () => {
    const invalid = [header, JSON.stringify({ type: "event" }), "{not json"].join("\n");
    const array = [header, JSON.stringify({ type: "event" }), "[1,2]"].join("\n");

    expect(() => parseEnvelopeEvent(invalid)).toThrow(InvalidEnvelopeError);
    expect(() => parseEnvelopeEvent(array)).toThrow("must be a JSON object");
  });
});

describe("grouping key bounds", () => {
  it("keeps ordinary legacy keys verbatim so existing issues can be adopted", () => {
    const key = computeLegacyGroupingKey({
      exception: { values: [{ type: "TypeError", value: "boom" }] },
    });

    expect(key.startsWith("TypeError|boom")).toBe(true);
  });

  it("hashes keys too long for the unique index, deterministically", () => {
    const payload = {
      exception: { values: [{ type: "Error", value: "x".repeat(10_000) }] },
    };
    const key = computeGroupingKey(payload);

    expect(key).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(computeGroupingKey(payload)).toBe(key);
    expect(boundGroupingKey("é".repeat(1_500))).toMatch(/^sha256:/);
  });
});
