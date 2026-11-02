/** Shared surface for text-like controls (input, select, textarea, combobox trigger). */
const controlClassName =
  "w-full rounded-md border border-input bg-card text-sm text-foreground shadow-xs outline-none transition-[color,background-color,border-color,box-shadow] duration-150 ease-out placeholder:text-subtle-foreground hover:border-border-strong focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-muted/30";

export { controlClassName };
