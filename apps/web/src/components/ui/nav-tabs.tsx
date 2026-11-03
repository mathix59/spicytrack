import type { ComponentType } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

import { tabsListVariants, tabsTriggerVariants } from "./tabs.styles";

type NavTabItem = {
  to: string;
  label: string;
  active: boolean;
  icon?: ComponentType<{ className?: string }>;
};

/**
 * Underline tabs whose sections are URLs, so they can be opened in a new tab or shared.
 * Looks identical to `<TabsList variant="underline">`.
 */
function NavTabs({
  label,
  items,
  className,
}: {
  label: string;
  items: NavTabItem[];
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cn("-mx-4 min-w-0 px-4 sm:mx-0 sm:px-0", className)}>
      <ul className={tabsListVariants({ variant: "underline" })}>
        {items.map(({ to, label: itemLabel, active, icon: Icon }) => (
          <li className="shrink-0" key={to}>
            <Link
              aria-current={active ? "page" : undefined}
              className={tabsTriggerVariants({ variant: "underline" })}
              to={to}
            >
              {Icon ? <Icon className="size-4" /> : null}
              {itemLabel}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export { NavTabs, type NavTabItem };
