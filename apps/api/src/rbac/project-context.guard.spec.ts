import { NotFoundException } from "@nestjs/common";
import { ProjectContextGuard } from "./project-context.guard";

function context(request: Record<string, unknown>) {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

describe("ProjectContextGuard", () => {
  it("resolves a project inside the current organization and attaches it to the request", async () => {
    const project = { id: "project-1", teamId: "team-1" };
    const projectsService = { getAccessibleBySlug: jest.fn(async () => project) };
    const guard = new ProjectContextGuard(projectsService as never);
    const request = {
      params: { projectSlug: "checkout" },
      auth: { user: { id: "user-1" } },
      organization: {
        organization: { id: "org-1" },
        membership: { role: "viewer" },
      },
    };

    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(projectsService.getAccessibleBySlug).toHaveBeenCalledWith({
      organizationId: "org-1",
      projectSlug: "checkout",
    });
    expect(request).toHaveProperty("project", project);
  });

  it.each([
    { params: { projectSlug: "checkout" } },
    { params: {}, auth: { user: { id: "user-1" } } },
    {
      params: { projectSlug: "checkout" },
      auth: { user: { id: "user-1" } },
      organization: { organization: { id: "org-1" } },
    },
  ])("rejects an incomplete request context", async (request) => {
    const guard = new ProjectContextGuard({ getAccessibleBySlug: jest.fn() } as never);
    await expect(guard.canActivate(context(request))).rejects.toBeInstanceOf(NotFoundException);
  });
});
