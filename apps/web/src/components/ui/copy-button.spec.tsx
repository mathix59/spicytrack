// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { copyToClipboard } from "@/lib/clipboard";

import { CopyButton } from "./copy-button";

vi.mock("@/lib/clipboard", () => ({ copyToClipboard: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.mocked(copyToClipboard).mockReset();
});

describe("CopyButton", () => {
  it("copies its value and shows it was copied for a moment", async () => {
    vi.useFakeTimers();
    vi.mocked(copyToClipboard).mockResolvedValue(true);
    render(
      <CopyButton label="Copy DSN" showLabel successMessage="DSN copied" value="https://dsn" />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy DSN" }));
    });

    expect(copyToClipboard).toHaveBeenCalledWith("https://dsn", "DSN copied");
    expect(screen.getByRole("button").textContent).toBe("Copied");
    act(() => vi.advanceTimersByTime(1500));
    expect(screen.getByRole("button").textContent).toBe("Copy DSN");
  });

  it("keeps its label when the clipboard refuses", async () => {
    vi.mocked(copyToClipboard).mockResolvedValue(false);
    render(<CopyButton label="Copy key" value="secret" />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Copy key" }));
    });

    expect(screen.getByRole("button", { name: "Copy key" }).className).not.toContain(
      "text-success",
    );
  });
});
