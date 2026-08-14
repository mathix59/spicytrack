import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { getGetMeQueryKey } from "@/generated/api";
import { authClient } from "@/lib/auth-client";
import { getErrorMessage } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

function TwoFactorPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      const result = await authClient.twoFactor.verifyTotp({
        code,
        trustDevice: false,
      });

      if (result.error) {
        throw new Error(result.error.message ?? "Invalid authenticator code");
      }

      await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      navigate("/app", { replace: true });
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-10 text-foreground">
      <Card className="w-full max-w-md">
        <CardHeader>
          <h1 className="text-lg font-semibold tracking-tight">Two-factor verification</h1>
          <CardDescription>Enter the current code from your authenticator app.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <form className="grid gap-4" onSubmit={submit}>
            <Field label="Authenticator code">
              <Input
                autoFocus
                inputMode="numeric"
                onChange={(event) => setCode(event.target.value)}
                placeholder="123456"
                value={code}
              />
            </Field>

            <Button disabled={isPending || code.length < 6} type="submit">
              <ShieldCheck className="size-4" />
              {isPending ? "Verifying…" : "Verify"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

export { TwoFactorPage };
