import { BellRing, Bug, Layers } from "lucide-react";

import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { AuthCredentialsForm } from "./auth-credentials-form";
import type { AuthenticationOptions } from "./use-authentication-options";
import type { AuthMode } from "./use-auth-form";

const HIGHLIGHTS = [
  { icon: Bug, text: "Works with the Sentry SDKs you already ship." },
  { icon: Layers, text: "Readable stack traces with source maps and release tracking." },
  { icon: BellRing, text: "Alerts that reach the right team before users report it." },
];

function AuthHeroPanel() {
  return (
    <div className="border-b border-border bg-muted/30 p-6 sm:p-8 lg:border-r lg:border-b-0 lg:p-10">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        SpicyTrack
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        Sentry-compatible.
        <br />
        Source available.
        <br />
        Multi-tenant.
      </h1>
      <p className="mt-6 max-w-xl text-sm leading-7 text-muted-foreground">
        Catch errors in production, group them into actionable issues and fix them with your team,
        on infrastructure you control.
      </p>
      <ul className="mt-6 hidden gap-3 text-sm text-muted-foreground sm:grid">
        {HIGHLIGHTS.map(({ icon: Icon, text }) => (
          <li className="flex items-start gap-3" key={text}>
            <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}

const TITLES: Record<AuthMode, string> = {
  login: "Sign in",
  register: "Create your account",
  forgot: "Forgot password",
};

const DESCRIPTIONS: Record<AuthMode, string> = {
  login: "Welcome back. Sign in to see your organizations, projects and issues.",
  register: "Start tracking errors across your projects in a few minutes.",
  forgot: "Enter your email and we'll send you a reset link if an account exists.",
};

function AuthModeSwitch({
  mode,
  switchMode,
}: {
  mode: AuthMode;
  switchMode: (nextMode: AuthMode) => void;
}) {
  const options = [
    { value: "login", label: "Sign in" },
    { value: "register", label: "Sign up" },
  ] as const;
  return (
    <div className="mb-6 flex rounded-md border border-border bg-muted p-1">
      {options.map((option) => (
        <button
          aria-pressed={mode === option.value}
          className={cn(
            "flex-1 rounded-sm px-4 py-2 text-sm font-medium transition-colors",
            mode === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          key={option.value}
          onClick={() => switchMode(option.value)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function AuthModePanel({
  mode,
  switchMode,
  forgotSent,
  error,
  isPending,
  onSubmit,
  onSsoSignIn,
  options,
}: {
  mode: AuthMode;
  switchMode: (nextMode: AuthMode) => void;
  forgotSent: boolean;
  error: string | null;
  isPending: boolean;
  onSubmit: React.FormEventHandler<HTMLFormElement>;
  onSsoSignIn: (providerId: string) => void;
  options: AuthenticationOptions;
}) {
  const { passwordEnabled, registrationsEnabled, sso } = options;
  return (
    <div className="p-6 sm:p-8 lg:p-10">
      <CardHeader className="p-0">
        <CardTitle className="text-2xl tracking-tight">{TITLES[mode]}</CardTitle>
        <CardDescription>{DESCRIPTIONS[mode]}</CardDescription>
      </CardHeader>

      <CardContent className="px-0 pb-0 pt-6">
        {passwordEnabled && mode !== "forgot" && registrationsEnabled ? (
          <AuthModeSwitch mode={mode} switchMode={switchMode} />
        ) : null}

        {mode === "login" && sso ? (
          <div className="mb-6 grid gap-4">
            <Button
              disabled={isPending}
              onClick={() => onSsoSignIn(sso.providerId)}
              size="lg"
              type="button"
              variant="secondary"
            >
              Continue with {sso.providerName}
            </Button>
            {passwordEnabled ? (
              <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                or
                <span className="h-px flex-1 bg-border" />
              </div>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <Alert className="mb-4" variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {mode === "forgot" && forgotSent ? (
          <div className="grid gap-4">
            <Alert role="status" variant="success">
              <AlertDescription>
                If an account exists for that email, a reset link is on its way.
              </AlertDescription>
            </Alert>
            <Button onClick={() => switchMode("login")} type="button" variant="secondary">
              Back to sign in
            </Button>
          </div>
        ) : passwordEnabled ? (
          <AuthCredentialsForm
            isPending={isPending}
            mode={mode}
            onSubmit={onSubmit}
            switchMode={switchMode}
          />
        ) : null}
      </CardContent>
    </div>
  );
}

export { AuthHeroPanel, AuthModePanel };
