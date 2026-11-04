import { LoaderCircle } from "lucide-react";

function LoadingScreen({ label, compact = false }: { label: string; compact?: boolean }) {
  const status = (
    <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
      <LoaderCircle className="size-4 animate-spin text-primary-accent" />
      {label}
    </div>
  );

  // The compact variant renders inside the app shell's <main>, so it must not add another one.
  if (compact) {
    return (
      <div aria-busy="true" className="grid min-h-[40vh] place-items-center px-6 text-foreground">
        {status}
      </div>
    );
  }

  return (
    <main
      aria-busy="true"
      className="grid min-h-screen place-items-center bg-background px-6 text-foreground"
    >
      {status}
    </main>
  );
}

export { LoadingScreen };
