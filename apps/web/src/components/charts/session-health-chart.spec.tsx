// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SessionHealthChart } from "./session-health-chart";

const points = [
  { start: "2026-11-01T00:00:00Z", sessions: 10_000, errored: 0, abnormal: 0, crashed: 1 },
  { start: "2026-11-02T00:00:00Z", sessions: 0, errored: 0, abnormal: 0, crashed: 0 },
  { start: "2026-11-03T00:00:00Z", sessions: 40, errored: 2, abnormal: 0, crashed: 0 },
];

afterEach(cleanup);

function renderChart() {
  render(<SessionHealthChart interval="day" label="Sessions per day" points={points} />);
  return screen.getAllByRole("button");
}

describe("SessionHealthChart", () => {
  it("keeps a single crash visible among thousands of sessions", () => {
    const [first] = renderChart();
    const crashed = first.querySelector(".bg-destructive") as HTMLElement;
    expect(crashed).not.toBeNull();
    expect(crashed.style.minHeight).toBe("4px");
  });

  it("is one tab stop, and arrow keys move the caption between bars", () => {
    const bars = renderChart();
    expect(bars.map((bar) => bar.tabIndex)).toEqual([-1, -1, 0]);

    fireEvent.focus(bars[2]);
    expect(screen.getByText(/40 sessions, 0 crashed/)).toBeTruthy();

    fireEvent.keyDown(bars[2], { key: "Home" });
    expect(document.activeElement).toBe(bars[0]);
    expect(screen.getAllByText(/10\D?000 sessions, 1 crashed/).length).toBeGreaterThan(0);
    expect(bars[0].getAttribute("aria-pressed")).toBe("true");
  });

  it("pins a tapped bar's breakdown", () => {
    const bars = renderChart();
    fireEvent.click(bars[1]);
    fireEvent.mouseLeave(bars[1].parentElement as HTMLElement);
    expect(bars[1].getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/0 sessions, 0 crashed/)).toBeTruthy();
  });
});
