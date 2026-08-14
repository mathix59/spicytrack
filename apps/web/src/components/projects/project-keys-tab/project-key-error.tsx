import { Alert, AlertDescription } from "@/components/ui/alert";

function ProjectKeyError({ error }: { error: string | null }) {
  return error ? (
    <Alert variant="destructive">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  ) : null;
}

export { ProjectKeyError };
