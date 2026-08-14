import type { FormEvent } from "react";
import type { PersonalAccessTokenDto, UserDto } from "@/generated/api";

type AccountPageData = {
  user: UserDto | undefined;
  tokens: PersonalAccessTokenDto[];
  tokenError: string | null;
  passwordError: string | null;
  verificationSent: boolean;
  createdSecret: string | null;
  passwordSaved: boolean;
  isSendingVerification: boolean;
  isCreatingToken: boolean;
  isRevokingToken: boolean;
  isChangingPassword: boolean;
  revokeOtherSessions: boolean;
  requestVerification: () => Promise<void>;
  createToken: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  changePassword: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  revokeToken: (tokenId: string) => Promise<void>;
  setRevokeOtherSessions: (value: boolean) => void;
};

export type { AccountPageData };
