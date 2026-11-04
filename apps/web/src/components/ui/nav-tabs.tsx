import { type ComponentType, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

import {
  edgeFadeMask,
  readScrollEdges,
  type ScrollEdges,
  scrollLeftToReveal,
} from "./nav-tabs.utils";
import { tabsListVariants, tabsTriggerVariants } from "./tabs.styles";

type NavTabItem = {
  to: string;
  label: string;
  active: boolean;
  icon?: ComponentType<{ className?: string }>;
};

/**
 * Underline tabs whose sections are URLs, so they can be opened in a new tab or shared.
 * Looks identical to `<TabsList variant="underline">`. On narrow screens the list scrolls: the
 * active tab is kept in view and faded edges show that more tabs are hidden.
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
  const listRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState<ScrollEdges>({ start: false, end: false });
  const activeTo = items.find((item) => item.active)?.to;

  useEffect(() => {
    const list = listRef.current;
    const activeItem = list?.querySelector<HTMLElement>('[aria-current="page"]')?.parentElement;
    if (!list || !activeItem) return;
    // The list is `relative`, so the item's offsetLeft is measured from the list itself.
    const next = scrollLeftToReveal(list, activeItem);
    if (next !== null) list.scrollLeft = next;
  }, [activeTo]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const update = () => {
      const next = readScrollEdges(list);
      setEdges((current) =>
        current.start === next.start && current.end === next.end ? current : next,
      );
    };
    update();
    list.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(list);
    return () => {
      list.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [items.length]);

  return (
    <nav aria-label={label} className={cn("-mx-4 min-w-0 px-4 sm:mx-0 sm:px-0", className)}>
      <ul
        className={cn(tabsListVariants({ variant: "underline" }), "relative")}
        ref={listRef}
        style={edgeFadeMask(edges)}
      >
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
