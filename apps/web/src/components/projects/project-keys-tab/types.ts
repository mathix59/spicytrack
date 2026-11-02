import type { FormEvent } from "react";

import type { ProjectKeyDto } from "@/generated/api";

type FirstEventStatus =
  | { state: "loading" }
  | { state: "unknown" }
  | { state: "waiting" }
  | { state: "received"; lastSeenAt: string | null };

type ProjectKeysTabData = {
  keys: ProjectKeyDto[];
  primaryKey: ProjectKeyDto | null;
  isLoading: boolean;
  loadError: unknown;
  retry: () => void;
  firstEvent: FirstEventStatus;
  createError: string | null;
  manageError: string | null;
  createOpen: boolean;
  managedKey: ProjectKeyDto | null;
  effectivePlatform: string;
  isCreating: boolean;
  isUpdating: boolean;
  setCreateOpen: (open: boolean) => void;
  setManagedKey: (key: ProjectKeyDto | null) => void;
  setSelectedPlatform: (platform: string) => void;
  createKey: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  saveKey: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  setKeyActive: (key: ProjectKeyDto, isActive: boolean) => Promise<void>;
  rotateKey: (keyId: string) => Promise<void>;
};

type ProjectKeysTabProps = {
  orgSlug: string;
  projectSlug: string;
  projectPlatform: string;
};

export type { FirstEventStatus, ProjectKeysTabData, ProjectKeysTabProps };
