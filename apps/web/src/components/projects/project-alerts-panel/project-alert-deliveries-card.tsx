import { Dot } from "lucide-react";

import type { AlertDeliveryDto } from "@/generated/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

import { compactDate, deliveryTitle } from "./utils";

function ProjectAlertDeliveriesCard({ deliveries }: { deliveries: AlertDeliveryDto[] }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Deliveries</CardTitle>
          <Badge variant="muted">{deliveries.length}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 p-4">
        {deliveries.length === 0 ? (
          <EmptyState
            title="No deliveries yet"
            description="Webhooks sent from this project will appear here with their delivery status."
          />
        ) : (
          deliveries.map((delivery) => (
            <div className="rounded-lg border border-border bg-muted/20 p-4" key={delivery.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Dot
                      className={
                        delivery.status === "success"
                          ? "size-5 text-emerald-400"
                          : "size-5 text-amber-400"
                      }
                    />
                    <p className="truncate font-medium">{deliveryTitle(delivery.payload)}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {compactDate(delivery.createdAt)}
                  </p>
                </div>
                <Badge variant={delivery.status === "success" ? "accent" : "muted"}>
                  {delivery.status} · {delivery.responseStatus ?? "n/a"}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="muted">payload</Badge>
                {delivery.responseBody ? <Badge variant="muted">response</Badge> : null}
              </div>
              <pre className="mt-3 overflow-x-auto rounded-md bg-muted/30 px-3 py-2 text-[11px] text-foreground">
                {JSON.stringify(delivery.payload, null, 2)}
              </pre>
              {delivery.responseBody ? (
                <pre className="mt-3 overflow-x-auto rounded-md bg-muted/30 px-3 py-2 text-[11px] text-foreground">
                  {delivery.responseBody}
                </pre>
              ) : null}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export { ProjectAlertDeliveriesCard };
