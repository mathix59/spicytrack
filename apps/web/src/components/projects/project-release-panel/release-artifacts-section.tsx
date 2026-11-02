import { Boxes, FileCode2, Trash2, UploadCloud } from "lucide-react";

import type { ReleaseArtifactDto } from "@/generated/api";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { QueryError } from "@/components/common/query-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SkeletonRows } from "@/components/ui/skeleton";

import { compactDate, formatBytes, renderNullableText } from "./utils";

function ReleaseArtifactsSection({
  releaseVersion,
  artifacts,
  isLoading,
  error,
  onRetry,
  uploadError,
  isUploading,
  onUpload,
  onDelete,
}: {
  releaseVersion: string;
  artifacts: ReleaseArtifactDto[];
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  uploadError: string | null;
  isUploading: boolean;
  onUpload: React.FormEventHandler<HTMLFormElement>;
  onDelete: (artifactId: string) => Promise<void>;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center gap-2">
        <Boxes className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-medium">Artifacts</h3>
        {isLoading ? null : <Badge variant="muted">{artifacts.length}</Badge>}
      </div>
      <form className="flex flex-col gap-2 sm:flex-row sm:items-center" onSubmit={onUpload}>
        <input
          accept=".js,.map,.mjs,.cjs,.txt,.json"
          aria-label="Artifact file"
          className="min-w-0 flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none transition-colors file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium focus-visible:border-ring"
          name="file"
          required
          type="file"
        />
        <Button disabled={isUploading} size="sm" type="submit" variant="secondary">
          <UploadCloud />
          {isUploading ? "Uploading…" : "Upload"}
        </Button>
      </form>
      {uploadError ? (
        <Alert variant="destructive">
          <AlertDescription>{uploadError}</AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <SkeletonRows className="[&>*]:h-11" rows={2} />
      ) : error ? (
        <QueryError error={error} onRetry={onRetry} title="Could not load artifacts" />
      ) : artifacts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No artifacts yet. Upload source maps, ProGuard mappings, or Dart obfuscation maps to
          restore readable stack traces.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-border">
          {artifacts.map((artifact) => (
            <li
              className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
              key={artifact.id}
            >
              <FileCode2 className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={artifact.name}>
                  {artifact.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatBytes(artifact.size)}
                  <span className="hidden sm:inline">
                    {" "}
                    · {renderNullableText(artifact.contentType, "n/a")}
                  </span>{" "}
                  · {compactDate(artifact.createdAt)}
                </p>
              </div>
              <ConfirmDialog
                confirmLabel="Delete artifact"
                description={
                  <span className="[overflow-wrap:anywhere]">
                    {artifact.name} will be removed from release {releaseVersion}. Stack traces that
                    rely on it will no longer be symbolicated.
                  </span>
                }
                onConfirm={() => onDelete(artifact.id)}
                successMessage={`${artifact.name} deleted`}
                title="Delete artifact?"
                trigger={
                  <Button
                    aria-label={`Delete ${artifact.name}`}
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 />
                  </Button>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export { ReleaseArtifactsSection };
