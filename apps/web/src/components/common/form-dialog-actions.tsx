import { Button } from "@/components/ui/button";
import { DialogClose, DialogFooter } from "@/components/ui/dialog";

function FormDialogActions({
  isPending,
  submitLabel,
  submitVariant,
  showCancel = true,
  buttonType = "submit",
  onSubmitClick,
}: {
  isPending?: boolean;
  submitLabel: string;
  submitVariant?: "default" | "secondary" | "ghost";
  showCancel?: boolean;
  buttonType?: "submit" | "button";
  onSubmitClick?: () => void;
}) {
  return (
    <DialogFooter>
      {showCancel ? (
        <DialogClose asChild>
          <Button type="button" variant="ghost">
            Cancel
          </Button>
        </DialogClose>
      ) : null}
      <Button
        disabled={isPending}
        onClick={onSubmitClick}
        type={buttonType}
        variant={submitVariant}
      >
        {submitLabel}
      </Button>
    </DialogFooter>
  );
}

export { FormDialogActions };
