import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { useDeleteOrganization } from "@/generated/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/utils";

/** Danger zone: permanently deletes the organization after the slug is typed back. */
export function DeleteOrganizationCard({ orgSlug }: { orgSlug: string }) {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useDeleteOrganization();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const confirmed = confirmation === orgSlug;

  const remove = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!confirmed || mutation.isPending) return;
    setError(null);
    try {
      await mutation.mutateAsync({ orgSlug });
      if (localStorage.getItem("spicytrack.lastOrg") === orgSlug)
        localStorage.removeItem("spicytrack.lastOrg");
      queryClient.clear();
      toast.success("Organization deleted");
      navigate("/app", { replace: true });
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="size-5" />
          Danger zone
        </CardTitle>
        <CardDescription>Irreversible actions for this organization.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 rounded-lg border border-destructive/40 bg-background p-4"
          onSubmit={(event) => void remove(event)}
        >
          <div className="grid gap-1">
            <h3 className="font-medium">Delete organization</h3>
            <p className="text-sm text-muted-foreground">
              This permanently deletes the organization, its projects, events, invitations and
              access keys. This cannot be undone.
            </p>
          </div>
          <Field label={`Type ${orgSlug} to confirm`}>
            <Input
              autoComplete="off"
              onChange={(event) => setConfirmation(event.target.value)}
              value={confirmation}
            />
          </Field>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <div>
            <Button disabled={!confirmed || mutation.isPending} type="submit" variant="destructive">
              {mutation.isPending ? "Deleting…" : "Delete organization permanently"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
