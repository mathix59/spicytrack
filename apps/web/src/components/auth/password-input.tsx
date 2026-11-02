import { type ComponentProps, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Password input with a show/hide toggle. All props (including the `id` and ARIA attributes
 * injected by `Field`) are forwarded to the underlying `<input>`.
 */
function PasswordInput({ className, ...props }: Omit<ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative">
      <Input className={cn("pr-10", className)} type={visible ? "text" : "password"} {...props} />
      <Button
        aria-controls={props.id}
        aria-label="Show password"
        aria-pressed={visible}
        className="absolute top-1/2 right-0.5 -translate-y-1/2"
        onClick={() => setVisible((value) => !value)}
        size="icon-sm"
        title={visible ? "Hide password" : "Show password"}
        type="button"
        variant="ghost"
      >
        <Icon />
      </Button>
    </div>
  );
}

export { PasswordInput };
