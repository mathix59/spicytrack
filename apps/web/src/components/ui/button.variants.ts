import { cva } from "class-variance-authority";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-out select-none active:translate-y-px disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-3 focus-visible:ring-ring/40 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm inset-shadow-[0_1px_0_oklch(1_0_0/18%)] hover:bg-primary/90",
        secondary:
          "border border-border bg-card text-secondary-foreground shadow-xs hover:border-border-strong hover:bg-accent dark:bg-secondary",
        ghost: "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        destructive:
          "bg-destructive-solid text-destructive-foreground shadow-sm hover:bg-destructive-solid/90",
        outline:
          "border border-border bg-transparent text-foreground hover:border-border-strong hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-9 px-3.5 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-5 text-base",
        icon: "size-9",
        "icon-sm": "size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export { buttonVariants };
