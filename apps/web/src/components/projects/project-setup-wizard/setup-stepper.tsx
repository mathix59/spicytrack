import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const STEPS = [
  { key: "platform", title: "Choose your platform" },
  { key: "install", title: "Install and configure" },
  { key: "verify", title: "Verify" },
] as const;
type StepKey = (typeof STEPS)[number]["key"];

function Stepper({ current, done }: { current: number; done: boolean }) {
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Setup progress">
      {STEPS.map((step, index) => {
        const complete = done || index < current;
        return (
          <li
            aria-current={index === current ? "step" : undefined}
            className="grid min-w-0 gap-2"
            key={step.key}
          >
            <span
              className={cn(
                "h-1 rounded-full bg-border",
                (complete || index === current) && "bg-primary",
              )}
            />
            <span
              className={cn(
                "flex min-w-0 items-center gap-1.5 text-xs font-medium",
                index === current ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {complete ? <Check aria-hidden="true" className="size-3.5 text-success" /> : null}
              <span className="truncate">{step.title}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export { Stepper, STEPS, type StepKey };
