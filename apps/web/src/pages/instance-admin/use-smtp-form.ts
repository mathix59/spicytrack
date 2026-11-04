import { useEffect, useState } from "react";

import type { InstanceSettings } from "./types";

type SmtpFields = Pick<
  InstanceSettings,
  "smtpHost" | "smtpPort" | "smtpSecure" | "smtpUser" | "smtpFrom"
>;

const SMTP_FIELDS = ["smtpHost", "smtpPort", "smtpSecure", "smtpUser", "smtpFrom"] as const;

function pickSmtpFields(settings: InstanceSettings | undefined): SmtpFields {
  return {
    smtpHost: settings?.smtpHost ?? null,
    smtpPort: settings?.smtpPort ?? null,
    smtpSecure: settings?.smtpSecure ?? null,
    smtpUser: settings?.smtpUser ?? null,
    smtpFrom: settings?.smtpFrom ?? null,
  };
}

/** True when the draft differs from the saved settings or a new password was typed. */
function isSmtpDraftDirty(saved: SmtpFields, draft: SmtpFields, pass: string) {
  return pass.length > 0 || SMTP_FIELDS.some((key) => saved[key] !== draft[key]);
}

/**
 * The SMTP form's draft, owned by the page so switching admin tabs keeps unsaved edits.
 * The draft follows the saved settings whenever they change (initial load or after saving).
 */
function useSmtpForm(settings: InstanceSettings | undefined) {
  const [value, setValue] = useState<SmtpFields>(() => pickSmtpFields(settings));
  const [pass, setPass] = useState("");
  const [syncedSettings, setSyncedSettings] = useState(settings);
  if (syncedSettings !== settings) {
    setSyncedSettings(settings);
    setValue(pickSmtpFields(settings));
  }

  const isDirty = settings ? isSmtpDraftDirty(pickSmtpFields(settings), value, pass) : false;

  // Leaving the page (reload, closing the tab, typing a URL) asks before dropping edits.
  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  return {
    value,
    setValue,
    pass,
    setPass,
    isDirty,
    reset: () => {
      setValue(pickSmtpFields(settings));
      setPass("");
    },
  };
}

type SmtpFormState = ReturnType<typeof useSmtpForm>;

export { isSmtpDraftDirty, pickSmtpFields, useSmtpForm };
export type { SmtpFields, SmtpFormState };
