import { useState } from "react";
import type { FormEvent } from "react";
import { KeyRound, Pencil, Trash2 } from "lucide-react";

import type { AlertRuleDto } from "@/generated/api";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { getErrorMessage } from "@/lib/utils";

import { AlertRuleConfigFields } from "./alert-rule-config-fields";
import type { DestinationType } from "./types";
import {
  BellRing,
  destinationLabel,
  Hash,
  Mail,
  ruleTriggerTypes,
  Siren,
  triggerLabel,
  Webhook,
} from "./utils";

function DestinationIcon({ type }: { type: string }) {
  const className = "size-4 shrink-0";
  if (type === "email") return <Mail className={className} />;
  if (type === "pagerduty") return <Siren className={className} />;
  if (type === "slack" || type === "teams" || type === "discord") {
    return <Hash className={className} />;
  }
  return <Webhook className={className} />;
}

/** One alert rule: a compact summary that expands into an inline edit form. */
function AlertRuleItem({
  rule,
  isSaving,
  isTesting,
  onSubmit,
  onDelete,
  onTest,
  onRotateSecret,
}: {
  rule: AlertRuleDto;
  isSaving: boolean;
  isTesting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onDelete: () => Promise<void>;
  onTest: () => void;
  onRotateSecret: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [destinationType, setDestinationType] = useState<DestinationType>(
    (rule.destinationType as DestinationType) ?? "webhook",
  );
  const [isActive, setIsActive] = useState(rule.isActive);

  const stopEditing = () => {
    setEditing(false);
    setError(null);
    setDestinationType((rule.destinationType as DestinationType) ?? "webhook");
    setIsActive(rule.isActive);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    setError(null);
    try {
      await onSubmit(event);
      setEditing(false);
    } catch (caughtError) {
      setError(getErrorMessage(caughtError));
    }
  };

  return (
    <form
      className="grid gap-4 rounded-lg border border-border bg-muted/20 p-4"
      onSubmit={(event) => void submit(event)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <BellRing className="size-4 shrink-0 text-muted-foreground" />
          <p className="truncate text-sm font-medium">{rule.name}</p>
        </div>
        <Badge variant={rule.isActive ? "success" : "muted"}>
          {rule.isActive ? "active" : "paused"}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {ruleTriggerTypes(rule).map((triggerType) => (
          <Badge key={triggerType} variant="muted">
            {triggerLabel(triggerType, rule.threshold, rule.thresholdWindowMinutes)}
          </Badge>
        ))}
        <Badge variant="muted">{rule.cooldownMinutes}m cooldown</Badge>
      </div>

      <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        <DestinationIcon type={rule.destinationType} />
        <span className="shrink-0">{destinationLabel(rule.destinationType)}</span>
        <span className="min-w-0 truncate font-mono text-foreground" title={rule.destinationTarget}>
          {rule.destinationTarget}
        </span>
        {rule.destinationType === "webhook" ? (
          <Badge
            className="ml-auto shrink-0"
            title={
              rule.hasSigningSecret
                ? "Deliveries carry an X-SpicyTrack-Signature header"
                : "Deliveries are not signed yet: generate a secret to sign them"
            }
            variant={rule.hasSigningSecret ? "success" : "warning"}
          >
            {rule.hasSigningSecret ? "signed" : "unsigned"}
          </Badge>
        ) : null}
      </div>

      {editing ? (
        <div className="grid gap-4 border-t border-border pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input defaultValue={rule.name} name="name" required />
            </Field>
            <Field label="Status">
              <div className="flex h-9 items-center gap-2">
                <input name="isActive" type="hidden" value={String(isActive)} />
                <Switch
                  aria-label="Alert rule status"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <span className="text-sm text-muted-foreground">
                  {isActive ? "Active" : "Paused"}
                </span>
              </div>
            </Field>
          </div>
          <AlertRuleConfigFields
            cooldownMinutes={rule.cooldownMinutes}
            current={rule}
            destinationType={destinationType}
            onDestinationTypeChange={setDestinationType}
            threshold={rule.threshold}
            thresholdWindowMinutes={rule.thresholdWindowMinutes}
            triggerTypes={ruleTriggerTypes(rule)}
          />
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ConfirmDialog
          confirmLabel="Delete rule"
          description="Notifications from this rule stop immediately. Past deliveries stay in the log."
          onConfirm={onDelete}
          successMessage="Alert rule deleted"
          title={`Delete “${rule.name}”?`}
          trigger={
            <Button
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              size="sm"
              type="button"
              variant="ghost"
            >
              <Trash2 />
              Delete rule
            </Button>
          }
        />
        <div className="flex flex-wrap gap-2">
          {rule.destinationType === "webhook" ? (
            <ConfirmDialog
              confirmLabel={rule.hasSigningSecret ? "Rotate secret" : "Generate secret"}
              description={
                rule.hasSigningSecret
                  ? "The current secret stops working immediately: update the receiver with the new one."
                  : "Deliveries will carry an X-SpicyTrack-Signature header your receiver can verify."
              }
              destructive={false}
              onConfirm={onRotateSecret}
              title={rule.hasSigningSecret ? "Rotate the signing secret?" : "Sign deliveries?"}
              trigger={
                <Button size="sm" type="button" variant="ghost">
                  <KeyRound />
                  {rule.hasSigningSecret ? "Rotate secret" : "Generate secret"}
                </Button>
              }
            />
          ) : null}
          <Button disabled={isTesting} onClick={onTest} size="sm" type="button" variant="outline">
            {isTesting ? "Testing…" : "Test"}
          </Button>
          {editing ? (
            <>
              <Button onClick={stopEditing} size="sm" type="button" variant="ghost">
                Cancel
              </Button>
              <Button disabled={isSaving} size="sm" type="submit">
                {isSaving ? "Saving…" : "Save changes"}
              </Button>
            </>
          ) : (
            <Button onClick={() => setEditing(true)} size="sm" type="button" variant="secondary">
              <Pencil />
              Edit
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}

export { AlertRuleItem };
