import { useQuery } from "@tanstack/react-query";

import { orvalFetch } from "@/lib/orval-fetch";

type AuthenticationOptions = {
  registrationsEnabled: boolean;
  passwordEnabled: boolean;
  sso: { providerId: string; providerName: string } | null;
};

const DEFAULT_OPTIONS: AuthenticationOptions = {
  registrationsEnabled: false,
  passwordEnabled: true,
  sso: null,
};

/**
 * Sign-in methods offered by this instance. Until they load (or if they cannot be loaded),
 * password sign-in stays available so users are never locked out of the form.
 */
function useAuthenticationOptions() {
  const query = useQuery({
    queryKey: ["auth", "registration-status"],
    queryFn: async () => {
      const result = await orvalFetch<{ data: AuthenticationOptions }>(
        "/auth/registration-status",
        { method: "GET" },
      );
      return result.data;
    },
    staleTime: 60_000,
  });

  return { options: query.data ?? DEFAULT_OPTIONS, isLoading: query.isPending };
}

export { useAuthenticationOptions };
export type { AuthenticationOptions };
