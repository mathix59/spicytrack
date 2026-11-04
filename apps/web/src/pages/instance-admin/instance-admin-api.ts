import { withReadableApiError } from "@/lib/api-error";
import { orvalFetch } from "@/lib/orval-fetch";

import type { AuditEntryPageDto, AuditFacetsDto } from "@/generated/api";
import type { AuditQueryParams } from "@/components/audit/use-audit-log";

import type { InstanceSettings, InstanceSettingsUpdate, InstanceUsersPage } from "./types";

// The generated client has no typed bodies for these endpoints, so they are called directly.
const JSON_HEADERS = { "Content-Type": "application/json" };

const instanceAdminKeys = {
  settings: ["instance-admin", "settings"] as const,
  users: (search: string, page: number) => ["instance-admin", "users", { search, page }] as const,
  allUsers: ["instance-admin", "users"] as const,
  audit: ["instance-admin", "audit"] as const,
  auditFacets: ["instance-admin", "audit", "facets"] as const,
};

function fetchInstanceSettings() {
  return withReadableApiError(async () => {
    const result = await orvalFetch<{ data: InstanceSettings }>("/instance-admin/settings", {
      method: "GET",
    });
    return result.data;
  });
}

function updateInstanceSettings(next: InstanceSettingsUpdate) {
  return withReadableApiError(async () => {
    const result = await orvalFetch<{ data: InstanceSettings }>("/instance-admin/settings", {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify(next),
    });
    return result.data;
  });
}

function testSmtpConnection(input: InstanceSettingsUpdate) {
  return withReadableApiError(() =>
    orvalFetch("/instance-admin/smtp/test", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(input),
    }),
  );
}

/** Sends an email with the saved SMTP settings to the signed-in administrator. */
function sendSmtpTestEmail() {
  return withReadableApiError(async () => {
    const result = await orvalFetch<{ data: { success: boolean; to: string } }>(
      "/instance-admin/smtp/test-email",
      { method: "POST" },
    );
    return result.data;
  });
}

function fetchInstanceUsers(search: string, page: number) {
  return withReadableApiError(async () => {
    const result = await orvalFetch<{ data: InstanceUsersPage }>("/instance-admin/users", {
      method: "GET",
      params: { search, page },
    });
    return result.data;
  });
}

function updateInstanceUserRole(userId: string, isSuperAdmin: boolean) {
  return withReadableApiError(() =>
    orvalFetch(`/instance-admin/users/${userId}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ isSuperAdmin }),
    }),
  );
}

function deleteInstanceUser(userId: string, confirmationEmail: string) {
  return withReadableApiError(() =>
    orvalFetch(`/instance-admin/users/${userId}`, {
      method: "DELETE",
      headers: JSON_HEADERS,
      body: JSON.stringify({ confirmationEmail }),
    }),
  );
}

function fetchInstanceAudit(params: AuditQueryParams & { cursor?: string }) {
  return withReadableApiError(async () => {
    const result = await orvalFetch<{ data: AuditEntryPageDto }>("/instance-admin/audit", {
      method: "GET",
      params,
    });
    return result.data;
  });
}

function fetchInstanceAuditFacets() {
  return withReadableApiError(async () => {
    const result = await orvalFetch<{ data: AuditFacetsDto }>("/instance-admin/audit/facets", {
      method: "GET",
    });
    return result.data;
  });
}

export {
  deleteInstanceUser,
  fetchInstanceAudit,
  fetchInstanceAuditFacets,
  fetchInstanceSettings,
  fetchInstanceUsers,
  instanceAdminKeys,
  sendSmtpTestEmail,
  testSmtpConnection,
  updateInstanceSettings,
  updateInstanceUserRole,
};
