import {
  buildSuggestedSavedSearchName,
  describeFilterSnapshot,
  type IssueFilterSnapshot,
} from "@/features/issues/saved-searches";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormDialogActions } from "@/components/common/form-dialog-actions";

function SaveViewDialog({
  saveSearchOpen,
  setSaveSearchOpen,
  currentFilterSnapshot,
  savedSearchName,
  setSavedSearchName,
  saveCurrentSearch,
}: {
  saveSearchOpen: boolean;
  setSaveSearchOpen: (open: boolean) => void;
  currentFilterSnapshot: IssueFilterSnapshot;
  savedSearchName: string;
  setSavedSearchName: (value: string) => void;
  saveCurrentSearch: () => void;
}) {
  return (
    <Dialog onOpenChange={setSaveSearchOpen} open={saveSearchOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save current view</DialogTitle>
          <DialogDescription>{describeFilterSnapshot(currentFilterSnapshot)}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="View name">
            <Input
              onChange={(event) => setSavedSearchName(event.target.value)}
              placeholder={buildSuggestedSavedSearchName(currentFilterSnapshot)}
              value={savedSearchName}
            />
          </Field>
        </div>
        <FormDialogActions
          buttonType="button"
          isPending={savedSearchName.trim().length === 0}
          onSubmitClick={saveCurrentSearch}
          submitLabel="Save view"
        />
      </DialogContent>
    </Dialog>
  );
}

export { SaveViewDialog };
