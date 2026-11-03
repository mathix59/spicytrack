import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthenticatedRequest } from "../common/authenticated-request";
import { AccessResolver } from "./access-resolver.service";
import { REQUIRED_PERMISSIONS_KEY } from "./permissions.decorator";
import { Permission } from "./permissions.types";
import { scopeForPermission, tokenAllows } from "../personal-tokens/token-scopes";

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accessResolver: AccessResolver,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions =
      this.reflector.getAllAndOverride<Permission[]>(REQUIRED_PERMISSIONS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? [];

    if (requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tokenScopes = request.auth?.token?.scopes;
    if (tokenScopes) {
      const needed = requiredPermissions.map(scopeForPermission);
      const missing = needed.find((scope) => !tokenAllows(tokenScopes, scope));
      if (missing) {
        throw new ForbiddenException(`This personal access token needs the ${missing} scope`);
      }
    }
    const membership = request.organization?.membership;

    if (!membership) {
      return false;
    }

    const missingPermissions = await this.accessResolver.missingPermissions(
      {
        organizationId: request.organization!.organization.id,
        role: membership.role,
        userId: request.auth?.user.id,
        teamId: request.project?.teamId,
      },
      requiredPermissions,
    );
    if (missingPermissions.length > 0) {
      throw new ForbiddenException(`Missing permission ${missingPermissions[0]}`);
    }

    return true;
  }
}
