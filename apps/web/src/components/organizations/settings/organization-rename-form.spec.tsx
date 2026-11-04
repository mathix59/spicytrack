// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { orvalFetch } from "@/lib/orval-fetch";

import { OrganizationRenameForm } from "./organization-rename-form";

vi.mock("@/lib/orval-fetch", () => ({ orvalFetch: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const organization = { name: "Acme", slug: "acme" };

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidate = vi.spyOn(queryClient, "invalidateQueries");
  render(
    <QueryClientProvider client={queryClient}>
      <OrganizationRenameForm organization={organization} />
    </QueryClientProvider>,
  );
  return { invalidate };
}

const input = () => screen.getByRole("textbox", { name: "Name" }) as HTMLInputElement;
const save = () => screen.getByRole("button", { name: "Save" }) as HTMLButtonElement;

afterEach(() => {
  cleanup();
  vi.mocked(orvalFetch).mockReset();
  vi.mocked(toast.success).mockReset();
});

describe("OrganizationRenameForm", () => {
  it("starts with the current name and only saves a changed, non-empty name", () => {
    renderForm();

    expect(input().value).toBe("Acme");
    expect(save().disabled).toBe(true);
    fireEvent.change(input(), { target: { value: "   " } });
    expect(save().disabled).toBe(true);
    fireEvent.change(input(), { target: { value: " Acme " } });
    expect(save().disabled).toBe(true);
    fireEvent.change(input(), { target: { value: "Acme Inc." } });
    expect(save().disabled).toBe(false);
  });

  it("saves the trimmed name and refreshes the organization and memberships", async () => {
    vi.mocked(orvalFetch).mockResolvedValue({ data: { ...organization, name: "Acme Inc." } });
    const { invalidate } = renderForm();

    fireEvent.change(input(), { target: { value: "  Acme Inc.  " } });
    await act(async () => {
      fireEvent.click(save());
    });

    expect(orvalFetch).toHaveBeenCalledWith(
      "/organizations/acme",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "Acme Inc." }) }),
    );
    expect(toast.success).toHaveBeenCalledWith("Organization renamed.");
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([["/organizations/acme"], ["/organizations"], ["/auth/me"]]),
    );
    expect(input().value).toBe("Acme Inc.");
  });

  it("shows the API error inline", async () => {
    vi.mocked(orvalFetch).mockRejectedValue(new Error('{"message":"Forbidden resource"}'));
    renderForm();

    fireEvent.change(input(), { target: { value: "Other" } });
    await act(async () => {
      fireEvent.click(save());
    });

    expect(screen.getByText("Forbidden resource")).toBeTruthy();
    expect(toast.success).not.toHaveBeenCalled();
  });
});
