// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAuthForm } from "./use-auth-form";

vi.mock("@/lib/auth-client", () => ({ authClient: {} }));

const SSO_ERROR = "SSO authentication failed. Please try again or contact your administrator.";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("useAuthForm", () => {
  it("shows the SSO error from the URL on mount and removes it from the URL", () => {
    window.history.replaceState({}, "", "/login?error=access_denied&error_description=nope&next=x");

    const { result } = renderHook(() => useAuthForm({ onAuthenticated: vi.fn() }));

    expect(result.current.error).toBe(SSO_ERROR);
    expect(window.location.search).toBe("?next=x");
  });

  it("starts without an error and leaves the URL alone when no SSO error is present", () => {
    window.history.replaceState({}, "", "/login?next=x");

    const { result } = renderHook(() => useAuthForm({ onAuthenticated: vi.fn() }));

    expect(result.current.error).toBeNull();
    expect(window.location.search).toBe("?next=x");
  });

  it("clears the SSO error when switching mode", () => {
    window.history.replaceState({}, "", "/login?error=access_denied");
    const { result } = renderHook(() => useAuthForm({ onAuthenticated: vi.fn() }));

    act(() => result.current.switchMode("register"));

    expect(result.current.error).toBeNull();
    expect(result.current.mode).toBe("register");
  });

  it("starts in register mode with an invitation token", () => {
    const { result } = renderHook(() =>
      useAuthForm({ onAuthenticated: vi.fn(), invitationToken: "token" }),
    );

    expect(result.current.mode).toBe("register");
  });
});
