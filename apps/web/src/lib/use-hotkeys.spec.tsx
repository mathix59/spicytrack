// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useHotkeys } from "./use-hotkeys";

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = window) {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("useHotkeys", () => {
  it("runs the handler of the pressed key and claims the event", () => {
    const next = vi.fn();
    renderHook(() => useHotkeys({ j: next }));

    const event = press("j");

    expect(next).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
    expect(press("x").defaultPrevented).toBe(false);
  });

  it("ignores keys held with a modifier or already handled", () => {
    const next = vi.fn();
    renderHook(() => useHotkeys({ j: next }));

    press("j", { ctrlKey: true });
    press("j", { metaKey: true });
    press("j", { altKey: true });
    const handled = new KeyboardEvent("keydown", { key: "j", cancelable: true });
    handled.preventDefault();
    window.dispatchEvent(handled);

    expect(next).not.toHaveBeenCalled();
  });

  it("stays out of fields, dialogs and menus", () => {
    const next = vi.fn();
    renderHook(() => useHotkeys({ j: next }));
    document.body.innerHTML = `
      <input id="field" />
      <div role="dialog"><button id="in-dialog">Ok</button></div>
      <div role="menu"><span id="in-menu">Item</span></div>`;

    for (const id of ["field", "in-dialog", "in-menu"]) {
      press("j", {}, document.getElementById(id)!);
    }

    expect(next).not.toHaveBeenCalled();
  });

  it("uses the latest handlers and stops when disabled", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ handler, enabled }) => useHotkeys({ j: handler }, enabled), {
      initialProps: { handler: first, enabled: true },
    });

    rerender({ handler: second, enabled: true });
    press("j");
    rerender({ handler: second, enabled: false });
    press("j");

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });
});
