import { withReadableApiError } from "@/lib/api-error";
import { orvalFetch } from "@/lib/orval-fetch";

import type { InstanceSettings, InstanceSettingsUpdate, InstanceUsersPage } from "./types";

// The generated client has no typed bodies for these endpoints, so they are called directly.
const JSON_HEADERS = { "Content-Type": "application/json" };

const instanceAdminKeys = {
  settings: ["instance-admin", "settings"] as const,
  users: (search: string, page: number) => ["instance-admin", "users", { search, page }] as const,
  allUsers: ["instance-admin", "users"] as const,
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

export {
  deleteInstanceUser,
  fetchInstanceSettings,
  fetchInstanceUsers,
  instanceAdminKeys,
  testSmtpConnection,
  updateInstanceSettings,
  updateInstanceUserRole,
};
