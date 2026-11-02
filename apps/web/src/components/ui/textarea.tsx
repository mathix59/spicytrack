import * as React from "react";

import { cn } from "@/lib/utils";

import { controlClassName } from "./control.styles";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(controlClassName, "flex min-h-24 px-3 py-2 leading-6", className)}
      ref={ref}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
