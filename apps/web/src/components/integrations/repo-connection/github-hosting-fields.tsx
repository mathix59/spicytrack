import type { RepoConnectionDto } from "@/generated/api";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

import { asOptionalString, type GitHubMode } from "./utils";

/** GitHub Cloud vs Enterprise Server selector, plus the explicit instance fields. */
function GithubHostingFields({
  connection,
  githubMode,
  disabled,
  onGithubModeChange,
}: {
  connection: RepoConnectionDto | null | undefined;
  githubMode: GitHubMode;
  disabled: boolean;
  onGithubModeChange: (mode: GitHubMode) => void;
}) {
  return (
    <>
      <Field
        hint="Use GitHub Cloud for github.com, or enter explicit instance URLs for GitHub Enterprise Server."
        label="Hosting"
      >
        <Select
          disabled={disabled}
          name="githubMode"
          onChange={(event) =>
            onGithubModeChange(event.target.value === "enterprise" ? "enterprise" : "cloud")
          }
          value={githubMode}
        >
          <option value="cloud">GitHub Cloud</option>
          <option value="enterprise">GitHub Enterprise Server</option>
        </Select>
      </Field>

      {githubMode === "enterprise" ? (
        <>
          <Field label="HTML URL">
            <Input
              defaultValue={asOptionalString(connection?.htmlUrl)}
              disabled={disabled}
              name="htmlUrl"
              placeholder="https://github.example.com"
              required
            />
          </Field>
          <Field hint="Usually ends with /api/v3 on GitHub Enterprise Server." label="API URL">
            <Input
              defaultValue={asOptionalString(connection?.apiUrl)}
              disabled={disabled}
              name="apiUrl"
              placeholder="https://github.example.com/api/v3"
              required
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Custom git user">
              <Input
                defaultValue={asOptionalString(connection?.gitUser) || "git"}
                disabled={disabled}
                name="gitUser"
                placeholder="git"
              />
            </Field>
            <Field label="Custom git port">
              <Input
                defaultValue={
                  connection?.gitPort === null || connection?.gitPort === undefined
                    ? "22"
                    : String(connection.gitPort)
                }
                disabled={disabled}
                min="1"
                name="gitPort"
                placeholder="22"
                type="number"
              />
            </Field>
          </div>
        </>
      ) : null}
    </>
  );
}

export { GithubHostingFields };
