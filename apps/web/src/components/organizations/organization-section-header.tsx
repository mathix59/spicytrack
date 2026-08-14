import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function OrganizationSectionHeader({
  title,
  count,
  action,
  children,
  description,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  children?: ReactNode;
  description?: string;
}) {
  return (
    <CardHeader className={children ? "gap-4" : undefined}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CardTitle>{title}</CardTitle>
          {count !== undefined ? <Badge variant="muted">{count}</Badge> : null}
        </div>
        {action}
      </div>
      {description ? <CardDescription>{description}</CardDescription> : null}
      {children}
    </CardHeader>
  );
}

export { OrganizationSectionHeader };
