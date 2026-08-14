import { CanActivate, ExecutionContext, Injectable, NotFoundException } from "@nestjs/common";
import { AuthenticatedRequest } from "../common/authenticated-request";
import { ProjectsService } from "../projects/projects.service";

@Injectable()
export class ProjectContextGuard implements CanActivate {
  constructor(private readonly projectsService: ProjectsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const organization = request.organization?.organization;
    const membership = request.organization?.membership;
    const user = request.auth?.user;
    const projectSlugValue = request.params.projectSlug;
    const projectSlug = Array.isArray(projectSlugValue) ? projectSlugValue[0] : projectSlugValue;

    if (!organization || !membership || !user || !projectSlug) {
      throw new NotFoundException("Project context is missing");
    }

    request.project = await this.projectsService.getAccessibleBySlug({
      organizationId: organization.id,
      projectSlug,
    });

    return true;
  }
}
