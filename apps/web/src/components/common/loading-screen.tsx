import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoaderCircle } from "lucide-react";

function LoadingScreen({ label, compact = false }: { label: string; compact?: boolean }) {
  return (
    <main
      className={
        compact
          ? "grid min-h-[40vh] place-items-center px-6 text-foreground"
          : "grid min-h-screen place-items-center bg-background px-6 text-foreground"
      }
    >
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <div className="grid size-11 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <LoaderCircle className="size-5 animate-spin" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Loading
          </p>
          <CardTitle className="text-lg tracking-[-0.02em]">{label}</CardTitle>
        </CardHeader>
        <CardContent className="text-center text-sm leading-6 text-muted-foreground">
          Preparing navigation, queries, and project context.
        </CardContent>
      </Card>
    </main>
  );
}

export { LoadingScreen };
