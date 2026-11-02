import type { UpdateOrganizationAiSettingsBodyDtoProvider } from "@/generated/api";

const AI_PROVIDERS = [
  {
    value: "anthropic",
    label: "Anthropic (Claude)",
    defaultModel: "claude-sonnet-5",
    keyPlaceholder: "sk-ant-…",
  },
  { value: "openai", label: "OpenAI (GPT)", defaultModel: "gpt-5.4", keyPlaceholder: "sk-…" },
  {
    value: "google",
    label: "Google (Gemini)",
    defaultModel: "gemini-3.5-flash",
    keyPlaceholder: "AIza…",
  },
] as const;

const PRICING_OVERRIDES_PLACEHOLDER = JSON.stringify(
  [
    {
      provider: "openai",
      model: "gpt-5.4",
      conditions: { processingMode: "standard" },
      ratesPerMillion: { input_tokens: 2.25, output_tokens: 13.5 },
    },
  ],
  null,
  2,
);

type AiUsageSummary = {
  days: number;
  totals: {
    runs: number;
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    estimatedCostMicros: number | null;
  };
};

function asOptionalString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asAiProvider(value: string): UpdateOrganizationAiSettingsBodyDtoProvider {
  if (value === "openai" || value === "google") {
    return value;
  }

  return "anthropic";
}

export { AI_PROVIDERS, PRICING_OVERRIDES_PLACEHOLDER, asAiProvider, asOptionalString };
export type { AiUsageSummary };
