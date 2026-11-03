import { useGetIssueSuspectCommits } from "@/generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { CommitRow } from "./commit-row";

function SuspectCommitsCard({
  orgSlug,
  projectSlug,
  issueId,
}: {
  orgSlug: string;
  projectSlug: string;
  issueId: string;
}) {
  const suspectsQuery = useGetIssueSuspectCommits(orgSlug, projectSlug, issueId, {
    query: {
      refetchInterval: (query) => (query.state.data?.data.status === "pending" ? 3000 : false),
    },
  });
  const data = suspectsQuery.data?.data;
  // Only worth the space once there is something to point at.
  if (!data?.suspects?.length) return null;

  return (
    <Card className="min-w-0" data-testid="suspect-commits">
      <CardHeader>
        <CardTitle className="text-base">Suspect commits</CardTitle>
        <CardDescription>
          Commits in {data.release?.version.slice(0, 12)} that changed files in this stack trace.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-4">
        {data.suspects.map((suspect) => (
          <CommitRow commit={suspect} key={suspect.sha}>
            <ul className="grid gap-0.5 text-xs text-muted-foreground">
              {suspect.matches.map((match) => (
                <li
                  className="font-mono [overflow-wrap:anywhere]"
                  key={`${match.path}:${match.depth}`}
                >
                  {match.path}
                  {match.function ? ` · ${match.function}` : ""}
                  {match.depth === 0 ? " · raised the error" : ""}
                </li>
              ))}
            </ul>
          </CommitRow>
        ))}
      </CardContent>
    </Card>
  );
}

export { SuspectCommitsCard };
