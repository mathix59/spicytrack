import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BrainCircuit, RefreshCw, Sparkles } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { orvalFetch } from "@/lib/orval-fetch";
import { getErrorMessage } from "@/lib/utils";

type Triage = {
  briefing: string;
  generatedAt: string;
  evidence: { eventCount: number; release: string | null; isRegressed: boolean };
};

function IssueTriageCard({
  orgSlug,
  projectSlug,
  issueId,
}: {
  orgSlug: string;
  projectSlug: string;
  issueId: string;
}) {
  const [triage, setTriage] = useState<Triage | null>(null);
  const queryClient = useQueryClient();
  const historyQuery = useQuery({
    queryKey: ["issue-triage-runs", orgSlug, projectSlug, issueId],
    queryFn: () =>
      orvalFetch<{ data: Triage[] }>(
        `/organizations/${orgSlug}/projects/${projectSlug}/issues/${issueId}/triage`,
        { method: "GET" },
      ).then((response) => response.data),
  });
  const triageMutation = useMutation({
    mutationFn: () =>
      orvalFetch<{ data: Triage }>(
        `/organizations/${orgSlug}/projects/${projectSlug}/issues/${issueId}/triage`,
        { method: "POST" },
      ).then((response) => response.data),
    onSuccess: async (result) => {
      setTriage(result);
      await queryClient.invalidateQueries({
        queryKey: ["issue-triage-runs", orgSlug, projectSlug, issueId],
      });
    },
  });
  const displayedTriage = triage ?? historyQuery.data?.[0] ?? null;

  return (
    <Card className="overflow-hidden border-violet-500/20">
      <CardHeader className="bg-gradient-to-r from-violet-500/[0.07] to-indigo-500/[0.03]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BrainCircuit className="size-4 text-violet-400" />
            <CardTitle className="text-base">AI triage</CardTitle>
          </div>
          {displayedTriage ? (
            <Button
              disabled={triageMutation.isPending}
              onClick={() => triageMutation.mutate()}
              size="sm"
              type="button"
              variant="ghost"
            >
              <RefreshCw className={triageMutation.isPending ? "animate-spin" : ""} />
              Refresh
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 pt-4">
        {displayedTriage ? (
          <>
            <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
              <span>
                {displayedTriage.evidence.eventCount} recent event
                {displayedTriage.evidence.eventCount === 1 ? "" : "s"}
              </span>
              {displayedTriage.evidence.release ? (
                <span>· release {displayedTriage.evidence.release}</span>
              ) : null}
              {displayedTriage.evidence.isRegressed ? <span>· possible regression</span> : null}
            </div>
            <div className="whitespace-pre-wrap text-sm leading-6 text-foreground">
              {displayedTriage.briefing}
            </div>
            {historyQuery.data && historyQuery.data.length > 1 ? (
              <p className="text-xs text-muted-foreground">
                {historyQuery.data.length} triage runs retained for this issue.
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Turn the latest issue signals into an evidence-based investigation plan.
            </p>
            <Button
              className="w-fit bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500"
              disabled={triageMutation.isPending}
              onClick={() => triageMutation.mutate()}
              size="sm"
              type="button"
            >
              <Sparkles className={triageMutation.isPending ? "animate-pulse" : ""} />
              {triageMutation.isPending ? "Analysing signals…" : "Generate triage"}
            </Button>
          </>
        )}
        {triageMutation.isError ? (
          <Alert variant="destructive">
            <AlertDescription>{getErrorMessage(triageMutation.error)}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}

export { IssueTriageCard };
