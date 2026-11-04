// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TwoFactorSetupPanel } from "./two-factor-setup-panel";

afterEach(cleanup);

const totpUri =
  "otpauth://totp/SpicyTrack:ada%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=SpicyTrack";

function renderPanel(uri = totpUri, secret = "JBSWY3DPEHPK3PXP") {
  return render(
    <TwoFactorSetupPanel
      isPending={false}
      onCancel={vi.fn()}
      onVerify={vi.fn()}
      setup={{ totpUri: uri, secret, backupCodes: ["aaaa-bbbb", "cccc-dddd"] }}
    />,
  );
}

describe("TwoFactorSetupPanel", () => {
  it("shows a QR code for the authenticator link", () => {
    renderPanel();

    const qr = screen.getByRole("img", { name: "QR code for authenticator app" });
    expect(qr.tagName.toLowerCase()).toBe("svg");
    expect(qr.querySelector("rect")?.getAttribute("fill")).toBe("#fff");
    expect(qr.querySelector("path")?.getAttribute("d")).toMatch(/^M\d+ \d+h\d+v1h-\d+z/);
  });

  it("draws a different code for a different link", () => {
    renderPanel();
    const first = screen.getByRole("img").querySelector("path")?.getAttribute("d");
    cleanup();

    renderPanel(totpUri.replace("JBSWY3DPEHPK3PXP", "KRSXG5CTMVRXEZLU"), "KRSXG5CTMVRXEZLU");
    const second = screen.getByRole("img").querySelector("path")?.getAttribute("d");

    expect(second).not.toBe(first);
  });

  it("keeps the setup key visible for manual entry", () => {
    renderPanel();

    expect(screen.getByText(/Can't scan\? Enter this key manually/)).toBeTruthy();
    expect(screen.getByText("JBSW Y3DP EHPK 3PXP")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy setup key" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copy setup link" })).toBeTruthy();
  });
});
