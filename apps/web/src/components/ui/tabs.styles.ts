import { cva } from "class-variance-authority";

/*
 * One tab language for the whole app:
 * - underline: page-level sections (project, account, instance admin, organization settings);
 *   also used by NavTabs when sections are URLs.
 * - segmented: sub-sections inside a page section (roles, releases/environments, integrations).
 * View toggles inside a list or panel use SegmentedControl, which shares the segmented look.
 */
const tabsListVariants = cva("flex items-center overflow-x-auto [scrollbar-width:none]", {
  variants: {
    variant: {
      underline: "w-full gap-1 border-b border-border",
      segmented:
        "inline-flex w-fit max-w-full gap-0.5 rounded-lg border border-border bg-muted/60 p-0.5",
    },
  },
  defaultVariants: { variant: "segmented" },
});

const tabsTriggerVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap text-sm font-medium text-muted-foreground outline-none transition-[color,background-color,border-color,box-shadow] duration-150 hover:text-foreground disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Keyboard focus only (never after a click, see TabsTrigger's data-pointer-focus): an
        // inset ring that stays inside the scrolling list instead of being clipped by it.
        underline:
          "-mb-px rounded-t-md border-b-2 border-transparent px-3 py-2.5 ring-inset ring-ring/50 [&:focus-visible:not([data-pointer-focus])]:text-foreground [&:focus-visible:not([data-pointer-focus])]:ring-2 data-[state=active]:border-primary-accent data-[state=active]:text-foreground aria-[current=page]:border-primary-accent aria-[current=page]:text-foreground",
        segmented:
          "h-7 rounded-md px-3 ring-ring/40 [&:focus-visible:not([data-pointer-focus])]:ring-3 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm",
      },
    },
    defaultVariants: { variant: "segmented" },
  },
);

type TabsVariant = "underline" | "segmented";

export { tabsListVariants, tabsTriggerVariants, type TabsVariant };
