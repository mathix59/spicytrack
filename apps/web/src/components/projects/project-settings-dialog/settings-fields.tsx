import { useMemo, useState } from "react";
import type { ProjectDto, TeamDto } from "@/generated/api";

import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PLATFORM_OPTIONS } from "@/lib/platforms";

function ProjectSettingsFields({ project, teams }: { project: ProjectDto; teams: TeamDto[] }) {
  const [inboundRules, setInboundRules] = useState(
    JSON.stringify(project.inboundRules ?? [], null, 2),
  );
  const [ownershipRules, setOwnershipRules] = useState(
    JSON.stringify(project.ownershipRules ?? [], null, 2),
  );
  const [previewText, setPreviewText] = useState("");
  const preview = useMemo(() => {
    if (!previewText.trim()) return null;
    try {
      const inbound = JSON.parse(inboundRules) as Array<Record<string, unknown>>;
      const ownership = JSON.parse(ownershipRules) as Array<Record<string, unknown>>;
      const searchable = previewText.toLowerCase();
      let inboundAction = "Accepted with default grouping";
      for (const rule of inbound) {
        if (typeof rule.pattern !== "string" || !searchable.includes(rule.pattern.toLowerCase())) {
          continue;
        }
        if (rule.action === "ignore") {
          inboundAction = "Ignored";
          break;
        }
        if (rule.action === "fingerprint") {
          inboundAction = `Fingerprint: ${String(rule.fingerprint ?? "missing")}`;
        }
      }
      const ownerMatch = ownership.find(
        (rule) =>
          typeof rule.pattern === "string" && searchable.includes(rule.pattern.toLowerCase()),
      );
      return {
        error: null,
        action: inboundAction,
        owner:
          typeof ownerMatch?.assignedUserId === "string"
            ? `Assigned to ${ownerMatch.assignedUserId}`
            : "No automatic owner",
      };
    } catch {
      return { error: "Rules must contain valid JSON before they can be previewed." };
    }
  }, [inboundRules, ownershipRules, previewText]);

  return (
    <>
      <Field label="Project name">
        <Input defaultValue={project.name} name="name" required />
      </Field>
      <Field label="Platform">
        <Select defaultValue={project.platform} name="platform">
          {PLATFORM_OPTIONS.map((platform) => (
            <option key={platform.value} value={platform.value}>
              {platform.label}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Status">
          <Select defaultValue={project.status} name="status">
            <option value="active">active</option>
            <option value="disabled">disabled</option>
          </Select>
        </Field>
        <Field label="Visibility">
          <Select defaultValue={project.visibility} name="visibility">
            <option value="private">private</option>
            <option value="internal">internal</option>
          </Select>
        </Field>
      </div>
      <Field label="Team">
        <Select defaultValue={project.teamId ?? ""} name="teamId">
          <option value="">No team</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Retention days">
        <Input defaultValue={project.retentionDays} min="1" name="retentionDays" type="number" />
      </Field>
      <Field
        label="Allowed browser origins"
        hint="One exact HTTP(S) origin per line for browser SDK ingestion, for example https://app.example.com. Leave empty to allow every browser origin."
      >
        <textarea
          className="min-h-20 rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          defaultValue={(project.browserAllowedOrigins ?? []).join("\n")}
          name="browserAllowedOrigins"
          placeholder={"https://app.example.com\nhttps://staging.example.com"}
        />
      </Field>
      <Field
        label="Noise and grouping rules"
        hint='JSON array. Example: [{"action":"ignore","pattern":"ResizeObserver"}] or [{"action":"fingerprint","pattern":"timeout","fingerprint":"network-timeout"}]'
      >
        <textarea
          className="min-h-28 rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          name="inboundRules"
          onChange={(event) => setInboundRules(event.target.value)}
          value={inboundRules}
        />
      </Field>
      <Field
        label="Ownership rules"
        hint='First matching rule wins. Example: [{"pattern":"src/payments/","assignedUserId":"user-uuid"}]'
      >
        <textarea
          className="min-h-28 rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          name="ownershipRules"
          onChange={(event) => setOwnershipRules(event.target.value)}
          value={ownershipRules}
        />
      </Field>
      <Field
        label="Rule preview"
        hint="Paste an error title, message, or culprit to test the unsaved rules above."
      >
        <Input
          onChange={(event) => setPreviewText(event.target.value)}
          placeholder="Timeout in src/payments/charge.ts"
          value={previewText}
        />
      </Field>
      {preview ? (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
          {"error" in preview && preview.error ? (
            <p className="text-destructive">{preview.error}</p>
          ) : (
            <div className="grid gap-1">
              <p className="font-medium">{preview.action}</p>
              <p className="text-muted-foreground">{preview.owner}</p>
            </div>
          )}
        </div>
      ) : null}
      <Field
        label="Additional PII fields"
        hint='JSON array of case-insensitive field names removed before storage, for example ["customerId", "internalToken"].'
      >
        <textarea
          className="min-h-20 rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          defaultValue={JSON.stringify(project.piiScrubFields ?? [], null, 2)}
          name="piiScrubFields"
        />
      </Field>
    </>
  );
}

export { ProjectSettingsFields };
