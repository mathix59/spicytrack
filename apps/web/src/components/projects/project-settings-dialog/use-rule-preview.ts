import { useMemo } from "react";

type RulePreview = { error: string } | { error: null; action: string; owner: string };

/** Evaluates unsaved inbound and ownership rules (JSON) against a sample error text. */
function useRulePreview(
  inboundRules: string,
  ownershipRules: string,
  previewText: string,
): RulePreview | null {
  return useMemo(() => {
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
}

export { useRulePreview };
