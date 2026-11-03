import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { saveBlob } from "@/lib/download";

function downloadBackupCodes(codes: string[]) {
  const content = [
    "SpicyTrack two-factor backup codes",
    `Generated ${new Date().toISOString()}`,
    "",
    "Each code can be used once to sign in if you lose access to your authenticator app.",
    "",
    ...codes,
    "",
  ].join("\n");
  saveBlob(
    new Blob([content], { type: "text/plain;charset=utf-8" }),
    "spicytrack-backup-codes.txt",
  );
}

function BackupCodes({ codes }: { codes: string[] }) {
  if (codes.length === 0) return null;
  return (
    <div className="grid gap-3">
      <ul
        aria-label="Backup codes"
        className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-background p-3 font-mono text-sm sm:grid-cols-3"
      >
        {codes.map((code) => (
          <li className="rounded bg-muted/40 px-2 py-1 text-center tracking-wider" key={code}>
            {code}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <CopyButton
          label="Copy all"
          showLabel
          successMessage="Backup codes copied"
          value={codes.join("\n")}
          variant="secondary"
        />
        <Button
          onClick={() => downloadBackupCodes(codes)}
          size="sm"
          type="button"
          variant="secondary"
        >
          <Download />
          Download .txt
        </Button>
      </div>
    </div>
  );
}

export { BackupCodes };
