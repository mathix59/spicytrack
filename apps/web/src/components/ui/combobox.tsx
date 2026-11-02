import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import { controlClassName } from "./control.styles";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

type ComboboxOption = {
  value: string;
  label: string;
  /** Secondary text shown under the label and matched by search (e.g. an email). */
  description?: string;
  icon?: React.ReactNode;
};

// Match on what the user can read (label, description), never on opaque ids.
function matchOption(_value: string, search: string, keywords?: string[]) {
  const query = search.trim().toLowerCase();
  return !query || keywords?.some((keyword) => keyword.toLowerCase().includes(query)) ? 1 : 0;
}

/**
 * Searchable single-select. The trigger is a button exposing the current label, so it reads
 * like a native select for assistive tech while scaling to long lists such as org members.
 */
function Combobox({
  id,
  value,
  options,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyText = "No results.",
  disabled,
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
}: {
  id?: string;
  value: string;
  options: ComboboxOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-describedby={ariaDescribedBy}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledBy}
          className={cn(
            controlClassName,
            "flex h-9 cursor-pointer items-center gap-2 px-3 text-left",
            className,
          )}
          disabled={disabled}
          id={id}
          role="combobox"
          type="button"
        >
          {selected?.icon}
          <span className={cn("min-w-0 flex-1 truncate", !selected && "text-subtle-foreground")}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[max(var(--radix-popover-trigger-width),16rem)] p-0">
        <Command filter={matchOption}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  keywords={[option.label, option.description ?? ""]}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  value={option.value}
                >
                  {option.icon}
                  <span className="grid min-w-0 flex-1">
                    <span className="truncate">{option.label}</span>
                    {option.description ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                  <Check
                    aria-hidden="true"
                    className={cn(
                      "!text-primary-accent",
                      option.value === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export { Combobox, type ComboboxOption };
