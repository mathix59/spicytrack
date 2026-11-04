// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useCommandPalette } from "./use-command-palette";

function press(init: KeyboardEventInit) {
  const event = new KeyboardEvent("keydown", { cancelable: true, ...init });
  act(() => {
    window.dispatchEvent(event);
  });
  return event;
}

afterEach(cleanup);

describe("useCommandPalette", () => {
  it("toggles on Cmd+K and Ctrl+K, whatever the case", () => {
    const { result } = renderHook(() => useCommandPalette());

    expect(press({ key: "k", metaKey: true }).defaultPrevented).toBe(true);
    expect(result.current.open).toBe(true);
    press({ key: "K", ctrlKey: true });
    expect(result.current.open).toBe(false);
  });

  it("leaves K alone without a modifier or with Alt", () => {
    const { result } = renderHook(() => useCommandPalette());

    expect(press({ key: "k" }).defaultPrevented).toBe(false);
    press({ key: "k", ctrlKey: true, altKey: true });

    expect(result.current.open).toBe(false);
  });
});
