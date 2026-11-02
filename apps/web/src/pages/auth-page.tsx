import { AuthForm } from "@/components/auth/auth-form";

function AuthPage({ onAuthenticated }: { onAuthenticated: () => void }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10 text-foreground sm:px-6">
      <div className="w-full max-w-6xl">
        <AuthForm onAuthenticated={onAuthenticated} />
      </div>
    </main>
  );
}

export { AuthPage };
