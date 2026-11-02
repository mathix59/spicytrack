import * as React from "react";

import { cn } from "@/lib/utils";

import { controlClassName } from "./control.styles";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        className={cn(
          controlClassName,
          "flex h-9 px-3 py-2 file:border-0 file:bg-transparent file:text-sm file:font-medium",
          className,
        )}
        type={type}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
