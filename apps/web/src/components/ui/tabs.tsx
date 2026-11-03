import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

import { type TabsVariant, tabsListVariants, tabsTriggerVariants } from "./tabs.styles";

const TabsVariantContext = React.createContext<TabsVariant>("segmented");

const Tabs = TabsPrimitive.Root;

function TabsList({
  className,
  variant = "segmented",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> & { variant?: TabsVariant }) {
  return (
    <TabsVariantContext.Provider value={variant}>
      <TabsPrimitive.List className={cn(tabsListVariants({ variant }), className)} {...props} />
    </TabsVariantContext.Provider>
  );
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const variant = React.useContext(TabsVariantContext);
  return (
    <TabsPrimitive.Trigger className={cn(tabsTriggerVariants({ variant }), className)} {...props} />
  );
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn("mt-0 outline-none", className)} {...props} />;
}

export { Tabs, TabsContent, TabsList, TabsTrigger };
