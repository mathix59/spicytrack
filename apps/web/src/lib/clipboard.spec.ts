// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { copyToClipboard } from "./clipboard";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");

function setClipboard(value: Clipboard | undefined) {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value });
}

function mockExecCommand(implementation: (command: string) => boolean) {
  const execCommand = vi.fn(implementation);
  Object.defineProperty(document, "execCommand", { configurable: true, value: execCommand });
  return execCommand;
}

beforeEach(() => {
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
});

afterEach(() => {
  if (originalClipboard) {
    Object.defineProperty(navigator, "clipboard", originalClipboard);
  } else {
    setClipboard(undefined);
  }
  Reflect.deleteProperty(document, "execCommand");
  document.body.innerHTML = "";
  window.getSelection()?.removeAllRanges();
});

describe("copyToClipboard", () => {
  it("uses the async clipboard API in a secure context", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText } as unknown as Clipboard);
    const execCommand = mockExecCommand(() => true);

    await expect(copyToClipboard("https://dsn", "DSN copied")).resolves.toBe(true);

    expect(writeText).toHaveBeenCalledWith("https://dsn");
    expect(execCommand).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("DSN copied");
  });

  it("falls back to a hidden textarea when the clipboard API is unavailable", async () => {
    setClipboard(undefined);
    let copiedText: string | null = null;
    const execCommand = mockExecCommand((command) => {
      const active = document.activeElement;
      copiedText = active instanceof HTMLTextAreaElement ? active.value : null;
      return command === "copy";
    });

    await expect(copyToClipboard("https://dsn")).resolves.toBe(true);

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(copiedText).toBe("https://dsn");
    expect(document.querySelector("textarea")).toBeNull();
    expect(toast.success).toHaveBeenCalledWith("Copied to clipboard");
  });

  it("falls back to the textarea when the clipboard API rejects", async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error("denied")) } as never);
    const execCommand = mockExecCommand(() => true);

    await expect(copyToClipboard("value")).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("reports the failure and selects the given element when both paths fail", async () => {
    setClipboard(undefined);
    mockExecCommand(() => false);
    const code = document.createElement("pre");
    code.textContent = "https://public@example.com/1";
    document.body.appendChild(code);

    await expect(
      copyToClipboard("https://public@example.com/1", "DSN copied", { selectOnFailure: code }),
    ).resolves.toBe(false);

    expect(window.getSelection()?.toString()).toBe("https://public@example.com/1");
    expect(toast.error).toHaveBeenCalledWith(
      "Could not access the clipboard. The value is selected: copy it manually.",
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("keeps the manual-copy error when nothing can be selected", async () => {
    setClipboard(undefined);
    mockExecCommand(() => {
      throw new Error("unsupported");
    });

    await expect(copyToClipboard("value")).resolves.toBe(false);
    expect(toast.error).toHaveBeenCalledWith(
      "Could not access the clipboard. Copy the value manually.",
    );
  });
});
