import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useDeleteOrganization } from "@/generated/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { getErrorMessage } from "@/lib/utils";

export function DeleteOrganizationCard({ orgSlug }: { orgSlug: string }) {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useDeleteOrganization();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const remove = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (confirmation !== orgSlug || mutation.isPending) return;
    setError(null);
    try {
      await mutation.mutateAsync({ orgSlug });
      if (localStorage.getItem("spicytrack.lastOrg") === orgSlug)
        localStorage.removeItem("spicytrack.lastOrg");
      queryClient.clear();
      navigate("/app", { replace: true });
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle>Delete organization</CardTitle>
        <CardDescription>
          This permanently deletes the organization, its projects, events, invitations and access
          keys. This cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={(event) => void remove(event)}>
          <Field label={`Type ${orgSlug} to confirm`}>
            <Input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
            />
          </Field>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button
            type="submit"
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={confirmation !== orgSlug || mutation.isPending}
          >
            Delete organization permanently
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
