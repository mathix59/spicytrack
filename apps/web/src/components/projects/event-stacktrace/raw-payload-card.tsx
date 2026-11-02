import { useMemo } from "react";
import { Copy } from "lucide-react";

import { CollapsibleSection } from "@/components/common/collapsible-section";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/clipboard";

function RawPayloadJson({ rawPayload }: { rawPayload: Record<string, unknown> }) {
  // Serialized only once the section is opened: payloads can be large.
  const json = useMemo(() => JSON.stringify(rawPayload, null, 2), [rawPayload]);
  return (
    <pre className="max-h-[32rem] max-w-full overflow-auto bg-background/60 p-4 font-mono text-xs leading-5 text-foreground">
      {json}
    </pre>
  );
}

function RawPayloadCard({ rawPayload }: { rawPayload: Record<string, unknown> }) {
  return (
    <CollapsibleSection
      actions={
        <Button
          aria-label="Copy raw payload"
          onClick={() =>
            void copyToClipboard(JSON.stringify(rawPayload, null, 2), "Payload copied")
          }
          size="icon-sm"
          title="Copy raw payload"
          type="button"
          variant="ghost"
        >
          <Copy />
        </Button>
      }
      defaultOpen={false}
      title="Raw payload"
    >
      <RawPayloadJson rawPayload={rawPayload} />
    </CollapsibleSection>
  );
}

export { RawPayloadCard };
