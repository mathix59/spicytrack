import { PLATFORM_OPTIONS } from "@/lib/platforms";
import {
  getSdkInstallSnippet,
  getSdkLanguage,
  getSdkSnippet,
  getSdkTestSnippet,
  platformLabel,
} from "@/components/projects/sdk-snippets-content";
import { CopyableCode } from "@/components/projects/sdk-snippets";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";

import { SETUP_PLATFORMS } from "./utils";

function ProjectKeySetupCard({
  dsn,
  effectivePlatform,
  onPlatformChange,
}: {
  dsn: string | undefined;
  effectivePlatform: string;
  onPlatformChange: (platform: string) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Setup</CardTitle>
          {dsn ? (
            <div className="w-[160px]">
              <Select
                aria-label="SDK platform"
                onChange={(event) => onPlatformChange(event.target.value)}
                value={effectivePlatform}
              >
                {PLATFORM_OPTIONS.filter((option) => SETUP_PLATFORMS.includes(option.value)).map(
                  (option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ),
                )}
              </Select>
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!dsn ? (
          <EmptyState
            description="Create a key first, then copy a DSN and drop the snippet into your SDK setup."
            title="No ingest key yet"
          />
        ) : (
          <>
            <CopyableCode
              label={`${platformLabel(effectivePlatform)} install`}
              value={getSdkInstallSnippet(effectivePlatform)}
            />
            <CopyableCode
              label={`${platformLabel(effectivePlatform)} init`}
              language={getSdkLanguage(effectivePlatform)}
              value={getSdkSnippet(effectivePlatform, dsn)}
            />
            <CopyableCode
              label="Test event"
              language={getSdkLanguage(effectivePlatform)}
              value={getSdkTestSnippet(effectivePlatform)}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

export { ProjectKeySetupCard };
