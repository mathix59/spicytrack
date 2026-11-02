import { LoaderCircle } from "lucide-react";

function LoadingScreen({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <main
      aria-busy="true"
      className={
        compact
          ? "grid min-h-[40vh] place-items-center px-6 text-foreground"
          : "grid min-h-screen place-items-center bg-background px-6 text-foreground"
      }
    >
      <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
        <LoaderCircle className="size-4 animate-spin text-primary-accent" />
        {label}
      </div>
    </main>
  );
}

export { LoadingScreen };
