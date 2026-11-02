import { useState } from "react";

import type { ProjectDto, TeamDto } from "@/generated/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PLATFORM_OPTIONS } from "@/lib/platforms";

import { SettingsSection } from "./settings-section";
import { useRulePreview } from "./use-rule-preview";

const CODE_TEXTAREA_CLASS_NAME = "font-mono text-xs";

function ProjectSettingsFields({ project, teams }: { project: ProjectDto; teams: TeamDto[] }) {
  const [inboundRules, setInboundRules] = useState(
    JSON.stringify(project.inboundRules ?? [], null, 2),
  );
  const [ownershipRules, setOwnershipRules] = useState(
    JSON.stringify(project.ownershipRules ?? [], null, 2),
  );
  const [previewText, setPreviewText] = useState("");
  const [status, setStatus] = useState(project.status);
  const preview = useRulePreview(inboundRules, ownershipRules, previewText);

  return (
    <>
      <SettingsSection title="General">
        <Field label="Project name">
          <Input defaultValue={project.name} name="name" required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Platform">
            <Select defaultValue={project.platform} name="platform">
              {PLATFORM_OPTIONS.map((platform) => (
                <option key={platform.value} value={platform.value}>
                  {platform.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field hint="How long events are kept before cleanup." label="Retention days">
            <Input
              defaultValue={project.retentionDays}
              min="1"
              name="retentionDays"
              type="number"
            />
          </Field>
        </div>
      </SettingsSection>

      <SettingsSection
        description="Control who sees this project and which browsers may send events to it."
        title="Visibility & access"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Visibility">
            <Select defaultValue={project.visibility} name="visibility">
              <option value="private">Private</option>
              <option value="internal">Internal</option>
            </Select>
          </Field>
          <Field hint="The team that owns this project." label="Team">
            <Select defaultValue={project.teamId ?? ""} name="teamId">
              <option value="">No team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field
          label="Allowed browser origins"
          hint="One exact HTTP(S) origin per line for browser SDK ingestion, for example https://app.example.com. Leave empty to allow every browser origin."
        >
          <Textarea
            className={`min-h-20 ${CODE_TEXTAREA_CLASS_NAME}`}
            defaultValue={(project.browserAllowedOrigins ?? []).join("\n")}
            name="browserAllowedOrigins"
            placeholder={"https://app.example.com\nhttps://staging.example.com"}
          />
        </Field>
      </SettingsSection>

      <SettingsSection
        description="Rules applied to incoming events before they are stored."
        title="Processing rules"
      >
        <Field
          label="Noise and grouping rules"
          hint='JSON array. Example: [{"action":"ignore","pattern":"ResizeObserver"}] or [{"action":"fingerprint","pattern":"timeout","fingerprint":"network-timeout"}]'
        >
          <Textarea
            className={`min-h-28 ${CODE_TEXTAREA_CLASS_NAME}`}
            name="inboundRules"
            onChange={(event) => setInboundRules(event.target.value)}
            value={inboundRules}
          />
        </Field>
        <Field
          label="Ownership rules"
          hint='First matching rule wins. Example: [{"pattern":"src/payments/","assignedUserId":"user-uuid"}]'
        >
          <Textarea
            className={`min-h-28 ${CODE_TEXTAREA_CLASS_NAME}`}
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
          <div
            aria-live="polite"
            className="rounded-lg border border-border bg-muted/30 p-3 text-xs"
          >
            {preview.error !== null ? (
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
          <Textarea
            className={`min-h-20 ${CODE_TEXTAREA_CLASS_NAME}`}
            defaultValue={JSON.stringify(project.piiScrubFields ?? [], null, 2)}
            name="piiScrubFields"
          />
        </Field>
      </SettingsSection>

      <SettingsSection
        danger
        description="A disabled project rejects every incoming event until it is reactivated."
        title="Danger zone"
      >
        <Field label="Project status">
          <Select name="status" onChange={(event) => setStatus(event.target.value)} value={status}>
            <option value="active">Active: accepting events</option>
            <option value="disabled">Disabled: rejecting events</option>
          </Select>
        </Field>
        {status === "disabled" && project.status !== "disabled" ? (
          <Alert variant="destructive">
            <AlertDescription>
              Saving will stop ingestion for every key of this project.
            </AlertDescription>
          </Alert>
        ) : null}
      </SettingsSection>
    </>
  );
}

export { ProjectSettingsFields };
