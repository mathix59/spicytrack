import type { CreateTicketTrackerBodyDtoProvider } from "@/generated/api";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type Provider = CreateTicketTrackerBodyDtoProvider;

function ProviderFields({ provider }: { provider: Provider }) {
  if (provider === "github") {
    return (
      <>
        <Field
          hint="Leave empty to use the repository connected to this project."
          label="Repository"
        >
          <Input name="repository" placeholder="owner/name" />
        </Field>
        <Field
          hint="Needed with a repository: a fine-grained token with Issues read and write."
          label="Token"
        >
          <Input autoComplete="off" name="token" type="password" />
        </Field>
      </>
    );
  }
  if (provider === "linear") {
    return (
      <>
        <Field hint="The prefix of the team's issues, like ENG." label="Team key">
          <Input name="teamKey" placeholder="ENG" required />
        </Field>
        <Field hint="Linear settings → Security & access → Personal API keys." label="API key">
          <Input autoComplete="off" name="token" required type="password" />
        </Field>
      </>
    );
  }
  return (
    <>
      <Field label="Site URL">
        <Input name="baseUrl" placeholder="https://acme.atlassian.net" required type="url" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Project key">
          <Input name="projectKey" placeholder="OPS" required />
        </Field>
        <Field label="Issue type">
          <Input defaultValue="Bug" name="issueType" required />
        </Field>
      </div>
      <Field hint="Jira Cloud only. Leave empty for a Data Center personal token." label="Email">
        <Input autoComplete="off" name="email" type="email" />
      </Field>
      <Field hint="Jira Cloud API token, or Data Center personal access token." label="Token">
        <Input autoComplete="off" name="token" required type="password" />
      </Field>
    </>
  );
}

export { ProviderFields, type Provider };
