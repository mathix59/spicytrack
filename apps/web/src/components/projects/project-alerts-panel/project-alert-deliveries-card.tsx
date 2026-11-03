import { Send } from "lucide-react";

import type { AlertDeliveryDto } from "@/generated/api";
import { QueryError } from "@/components/common/query-error";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SkeletonRows } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import type { ProjectAlertsPanelData } from "./types";
import { compactDate, deliveryTitle } from "./utils";

const PRE_CLASS_NAME =
  "mt-2 max-h-64 overflow-auto rounded-md bg-muted/30 px-3 py-2 font-mono text-[11px] text-foreground";

const STATUS_STYLES = {
  success: { dot: "bg-success", badge: "success" },
  failed: { dot: "bg-destructive", badge: "danger" },
  pending: { dot: "bg-muted-foreground", badge: "muted" },
  retrying: { dot: "bg-warning", badge: "warning" },
} as const;

function deliveryStatusLabel(delivery: AlertDeliveryDto) {
  const response = delivery.responseStatus ? ` · ${delivery.responseStatus}` : "";
  const attempts = delivery.attempts > 1 ? ` · ${delivery.attempts} attempts` : "";
  return `${delivery.status}${response}${attempts}`;
}

function DeliveryItem({ delivery }: { delivery: AlertDeliveryDto }) {
  const style =
    STATUS_STYLES[delivery.status as keyof typeof STATUS_STYLES] ?? STATUS_STYLES.failed;

  return (
    <li className="min-w-0 rounded-lg border border-border bg-muted/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span
            aria-hidden="true"
            className={cn("mt-1.5 size-2 shrink-0 rounded-full", style.dot)}
          />
          <div className="min-w-0">
            <p className="truncate font-medium">{deliveryTitle(delivery.payload)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{compactDate(delivery.createdAt)}</p>
          </div>
        </div>
        <Badge className="shrink-0" variant={style.badge}>
          {deliveryStatusLabel(delivery)}
        </Badge>
      </div>
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          Payload
        </summary>
        <pre className={PRE_CLASS_NAME}>{JSON.stringify(delivery.payload, null, 2)}</pre>
      </details>
      {delivery.responseBody ? (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            Response
          </summary>
          <pre className={PRE_CLASS_NAME}>{delivery.responseBody}</pre>
        </details>
      ) : null}
    </li>
  );
}

function ProjectAlertDeliveriesCard({ state }: { state: ProjectAlertsPanelData }) {
  const { deliveries, deliveriesQuery } = state;

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <CardTitle>Deliveries</CardTitle>
            <CardDescription>
              Latest notifications sent by this project&apos;s rules.
            </CardDescription>
          </div>
          {deliveriesQuery.isLoading ? null : <Badge variant="muted">{deliveries.length}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 p-3 sm:p-4">
        {deliveriesQuery.isLoading ? (
          <SkeletonRows rows={3} />
        ) : deliveriesQuery.error ? (
          <QueryError
            error={deliveriesQuery.error}
            onRetry={deliveriesQuery.retry}
            title="Could not load alert deliveries"
          />
        ) : deliveries.length === 0 ? (
          <EmptyState
            description="Use Test on a rule to send a sample notification; every delivery shows up here with its status."
            icon={Send}
            title="No deliveries yet"
          />
        ) : (
          <ul className="grid gap-3">
            {deliveries.map((delivery) => (
              <DeliveryItem delivery={delivery} key={delivery.id} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export { ProjectAlertDeliveriesCard };
