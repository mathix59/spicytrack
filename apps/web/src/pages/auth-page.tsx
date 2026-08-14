import { AuthForm } from "@/components/auth/auth-form";

function AuthPage({ onAuthenticated }: { onAuthenticated: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6 py-10 text-foreground">
      <div className="w-full max-w-6xl">
        <AuthForm onAuthenticated={onAuthenticated} />
      </div>
    </main>
  );
}

export { AuthPage };
