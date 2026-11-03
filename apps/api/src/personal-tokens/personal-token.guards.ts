import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";

import type { AuthenticatedRequest } from "../common/authenticated-request";
import { tokenAllows } from "./token-scopes";

function requestToken(context: ExecutionContext) {
  return context.switchToHttp().getRequest<AuthenticatedRequest>().auth?.token;
}

/** Token management needs a signed-in session: a leaked token cannot mint or revoke others. */
@Injectable()
export class SessionOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    if (requestToken(context)) {
      throw new ForbiddenException("Personal access tokens cannot manage tokens; sign in instead");
    }
    return true;
  }
}

/** Instance administration by token needs the admin scope and no organization restriction. */
@Injectable()
export class InstanceAdminTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const token = requestToken(context);
    if (token && (token.organizationId || !tokenAllows(token.scopes, "admin"))) {
      throw new ForbiddenException(
        "Instance administration needs a token with the admin scope and no organization restriction",
      );
    }
    return true;
  }
}
