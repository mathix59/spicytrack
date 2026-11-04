import { useEffect, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteInstanceUser,
  fetchInstanceUsers,
  instanceAdminKeys,
  updateInstanceUserRole,
} from "./instance-admin-api";

const SEARCH_DEBOUNCE_MS = 250;

function useInstanceUsers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const usersQuery = useQuery({
    queryKey: instanceAdminKeys.users(debouncedSearch, page),
    queryFn: () => fetchInstanceUsers(debouncedSearch, page),
    placeholderData: keepPreviousData,
  });

  const data = usersQuery.data;

  const refresh = () => queryClient.invalidateQueries({ queryKey: instanceAdminKeys.allUsers });

  return {
    usersQuery,
    users: data?.items ?? [],
    total: data?.total ?? 0,
    /** Undefined until loaded (or from an API that does not report it). */
    superAdminCount: data?.superAdminCount,
    page,
    pageSize: data?.pageSize ?? 20,
    search,
    setSearch,
    setPage,
    changeRole: async (userId: string, isSuperAdmin: boolean) => {
      await updateInstanceUserRole(userId, isSuperAdmin);
      await refresh();
    },
    deleteUser: async (userId: string, confirmationEmail: string) => {
      await deleteInstanceUser(userId, confirmationEmail);
      // Step back when the last user of a page was removed.
      if (page > 1 && data?.items.length === 1) setPage(page - 1);
      await refresh();
    },
  };
}

type InstanceUsersState = ReturnType<typeof useInstanceUsers>;

export { useInstanceUsers };
export type { InstanceUsersState };
