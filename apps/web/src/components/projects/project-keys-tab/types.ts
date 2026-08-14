import type { FormEvent } from "react";

import type { ProjectKeyDto } from "@/generated/api";

type ProjectKeysTabData = {
  error: string | null;
  createOpen: boolean;
  managedKey: ProjectKeyDto | null;
  keys: ProjectKeyDto[];
  primaryKey: ProjectKeyDto | null;
  effectivePlatform: string;
  isCreating: boolean;
  isUpdating: boolean;
  isRotating: boolean;
  setCreateOpen: (open: boolean) => void;
  setManagedKey: (key: ProjectKeyDto | null) => void;
  setSelectedPlatform: (platform: string) => void;
  createKey: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  saveKey: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  updateKey: (key: ProjectKeyDto, isActive: boolean) => Promise<void>;
  rotateKey: (keyId: string) => Promise<void>;
  resetError: () => void;
};

type ProjectKeysTabProps = {
  orgSlug: string;
  projectSlug: string;
  projectPlatform: string;
};

export type { ProjectKeysTabData, ProjectKeysTabProps };
