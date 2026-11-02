import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import { PasswordInput } from "./password-input";
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT } from "./password-policy";
import type { AuthMode } from "./use-auth-form";

const SUBMIT_LABELS: Record<AuthMode, { idle: string; pending: string }> = {
  login: { idle: "Sign in", pending: "Signing in…" },
  register: { idle: "Create account", pending: "Creating account…" },
  forgot: { idle: "Send reset link", pending: "Sending…" },
};

function AuthCredentialsForm({
  mode,
  isPending,
  onSubmit,
  switchMode,
}: {
  mode: AuthMode;
  isPending: boolean;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  switchMode: (nextMode: AuthMode) => void;
}) {
  const labels = SUBMIT_LABELS[mode];
  return (
    <form aria-busy={isPending} className="grid gap-4" onSubmit={onSubmit}>
      {mode === "register" ? (
        <Field label="Name">
          <Input autoComplete="name" name="name" placeholder="Jane Doe" />
        </Field>
      ) : null}

      <Field label="Email">
        <Input
          autoComplete="email"
          name="email"
          placeholder="jane@company.dev"
          required
          type="email"
        />
      </Field>

      {mode === "login" ? (
        <Field label="Password">
          <PasswordInput autoComplete="current-password" name="password" required />
        </Field>
      ) : mode === "register" ? (
        <Field hint={PASSWORD_HINT} label="Password">
          <PasswordInput
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            name="password"
            required
          />
        </Field>
      ) : null}

      {mode === "login" ? (
        <button
          className="justify-self-start text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          onClick={() => switchMode("forgot")}
          type="button"
        >
          Forgot password?
        </button>
      ) : null}

      <Button className="mt-2" disabled={isPending} size="lg" type="submit">
        {isPending ? <Loader2 className="animate-spin" /> : null}
        {isPending ? labels.pending : labels.idle}
      </Button>

      {mode === "forgot" ? (
        <Button onClick={() => switchMode("login")} type="button" variant="ghost">
          Back to sign in
        </Button>
      ) : null}
    </form>
  );
}

export { AuthCredentialsForm };
