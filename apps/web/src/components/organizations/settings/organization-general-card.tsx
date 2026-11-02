import type { OrganizationDto } from "@/generated/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";

function DetailRow({
  label,
  value,
  copyLabel,
}: {
  label: string;
  value: string;
  copyLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1">
        <code className="truncate font-mono text-sm text-foreground">{value}</code>
        {copyLabel ? (
          <CopyButton label={copyLabel} successMessage={`${label} copied`} value={value} />
        ) : null}
      </dd>
    </div>
  );
}

/** Read-only identity of the organization (no rename endpoint exists yet). */
function OrganizationGeneralCard({ organization }: { organization: OrganizationDto }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle>General</CardTitle>
          <Badge variant={organization.status === "active" ? "success" : "muted"}>
            {organization.status}
          </Badge>
        </div>
        <CardDescription>
          Identifiers used in URLs, the API and SDK tooling for this organization.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl>
          <DetailRow label="Name" value={organization.name} />
          <DetailRow copyLabel="Copy slug" label="Slug" value={organization.slug} />
          <DetailRow
            copyLabel="Copy organization ID"
            label="Organization ID"
            value={organization.id}
          />
        </dl>
      </CardContent>
    </Card>
  );
}

export { OrganizationGeneralCard };
