import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { EndpointAccessMode } from "../auth/endpoint-access.decorator";
import { ROLE_PERMISSIONS } from "./permissions.constants";
import type { Permission } from "./permissions.types";

const HTTP_DECORATORS = new Set([
  "Get",
  "Post",
  "Put",
  "Patch",
  "Delete",
  "Options",
  "Head",
  "All",
]);
const ALTERNATIVE_AUTH = new Set<EndpointAccessMode>([
  "public",
  "project-key",
  "github-signature",
  "mcp-credential",
]);

interface DecoratorInfo {
  name: string;
  arguments: string[];
}

interface RouteSecurity {
  id: string;
  file: string;
  path: string;
  guards: Set<string>;
  permissions: Permission[];
  access?: EndpointAccessMode;
}

function discoverControllerFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return discoverControllerFiles(absolute);
    return entry.name.endsWith(".controller.ts") ? [absolute] : [];
  });
}

function decorators(node: ts.Node): DecoratorInfo[] {
  if (!ts.canHaveDecorators(node)) return [];
  return (ts.getDecorators(node) ?? []).flatMap((decorator) => {
    const expression = decorator.expression;
    if (ts.isIdentifier(expression)) return [{ name: expression.text, arguments: [] }];
    if (!ts.isCallExpression(expression)) return [];
    const name = ts.isIdentifier(expression.expression)
      ? expression.expression.text
      : expression.expression.getText();
    return [{ name, arguments: expression.arguments.map((argument) => argument.getText()) }];
  });
}

function stringValue(value?: string): string {
  if (!value) return "";
  return value.replace(/^["'`]|["'`]$/g, "");
}

function combinePath(...parts: string[]): string {
  return `/${parts.filter(Boolean).join("/")}`.replace(/\/{2,}/g, "/");
}

function routeSecurityMatrix(): RouteSecurity[] {
  const root = path.join(__dirname, "..");
  const routes: RouteSecurity[] = [];

  for (const file of discoverControllerFiles(root)) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    source.forEachChild((node) => {
      if (!ts.isClassDeclaration(node) || !node.name) return;
      const classDecorators = decorators(node);
      const controller = classDecorators.find((decorator) => decorator.name === "Controller");
      if (!controller) return;

      for (const member of node.members) {
        if (!ts.isMethodDeclaration(member) || !member.name) continue;
        const methodDecorators = decorators(member);
        const http = methodDecorators.find((decorator) => HTTP_DECORATORS.has(decorator.name));
        if (!http) continue;

        const effectiveDecorators = [...classDecorators, ...methodDecorators];
        const guards = new Set(
          effectiveDecorators
            .filter((decorator) => decorator.name === "UseGuards")
            .flatMap((decorator) => decorator.arguments),
        );
        const permissionDecorator = methodDecorators.find(
          (decorator) => decorator.name === "RequirePermissions",
        );
        const accessDecorator = [...effectiveDecorators]
          .reverse()
          .find((decorator) => decorator.name === "EndpointAccess");
        const methodName = member.name.getText(source);

        routes.push({
          id: `${node.name.text}.${methodName}`,
          file: path.relative(root, file),
          path: combinePath(stringValue(controller.arguments[0]), stringValue(http.arguments[0])),
          guards,
          permissions: (permissionDecorator?.arguments.map(stringValue) ?? []) as Permission[],
          access: accessDecorator
            ? (stringValue(accessDecorator.arguments[0]) as EndpointAccessMode)
            : undefined,
        });
      }
    });
  }

  return routes.sort((left, right) => left.id.localeCompare(right.id));
}

describe("HTTP endpoint security contract", () => {
  const routes = routeSecurityMatrix();

  it("discovers the complete controller surface", () => {
    // This count makes parser regressions and unreviewed endpoint additions visible.
    expect(routes).toHaveLength(116);
    expect(new Set(routes.map((route) => route.id)).size).toBe(routes.length);
  });

  it("requires session authentication unless an alternative access mode is explicit", () => {
    const violations = routes.flatMap((route) => {
      const hasAuthGuard = route.guards.has("AuthGuard");
      if (route.access === "instance-admin") {
        return hasAuthGuard ? [] : [`${route.id}: instance admin route without AuthGuard`];
      }
      if (route.access && ALTERNATIVE_AUTH.has(route.access)) {
        return hasAuthGuard
          ? [`${route.id}: ${route.access} route unexpectedly mixed with AuthGuard`]
          : [];
      }
      return hasAuthGuard ? [] : [`${route.id}: no authentication boundary declared`];
    });

    expect(violations).toEqual([]);
  });

  it("protects every organization route with context and an explicit permission", () => {
    const violations = routes
      .filter((route) => route.path.includes(":orgSlug"))
      .flatMap((route) => {
        const missing = ["AuthGuard", "OrganizationContextGuard", "PermissionGuard"].filter(
          (guard) => !route.guards.has(guard),
        );
        if (route.permissions.length === 0) missing.push("RequirePermissions");
        return missing.length ? [`${route.id}: missing ${missing.join(", ")}`] : [];
      });

    expect(violations).toEqual([]);
  });

  it("protects every project route with tenant context and project permissions", () => {
    const violations = routes
      .filter((route) => route.path.includes(":projectSlug"))
      .flatMap((route) => {
        const missing = [
          "AuthGuard",
          "OrganizationContextGuard",
          "ProjectContextGuard",
          "PermissionGuard",
        ].filter((guard) => !route.guards.has(guard));
        if (
          route.permissions.length === 0 ||
          route.permissions.some(
            (permission) =>
              !permission.startsWith("project.") &&
              permission !== "audit.read" &&
              permission !== "org.projects.update",
          )
        ) {
          missing.push("project-scoped RequirePermissions");
        }
        return missing.length ? [`${route.id}: missing ${missing.join(", ")}`] : [];
      });

    expect(violations).toEqual([]);
  });

  it("keeps every declared permission attached to an API handler", () => {
    const routedPermissions = new Set(routes.flatMap((route) => route.permissions));
    expect([...routedPermissions].sort()).toEqual([...ROLE_PERMISSIONS.owner].sort());
  });

  it("rejects duplicate or unknown permission metadata", () => {
    const declaredPermissions = new Set<Permission>(ROLE_PERMISSIONS.owner);
    const violations = routes.flatMap((route) => {
      const duplicate = new Set(route.permissions).size !== route.permissions.length;
      const unknown = route.permissions.filter(
        (permission) => !declaredPermissions.has(permission),
      );
      return [
        ...(duplicate ? [`${route.id}: duplicate permission`] : []),
        ...unknown.map((permission) => `${route.id}: unknown permission ${permission}`),
      ];
    });

    expect(violations).toEqual([]);
  });
});
