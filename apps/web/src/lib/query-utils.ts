import type { QueryClient, QueryKey } from "@tanstack/react-query";

async function invalidateQueryKeys(queryClient: QueryClient, queryKeys: QueryKey[]) {
  await Promise.all(
    queryKeys.map((queryKey) =>
      queryClient.invalidateQueries({
        queryKey,
      }),
    ),
  );
}

export { invalidateQueryKeys };
