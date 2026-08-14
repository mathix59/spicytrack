import { SetMetadata } from "@nestjs/common";

export const ENDPOINT_ACCESS_KEY = "endpoint_access";

export type EndpointAccessMode =
  | "public"
  | "project-key"
  | "github-signature"
  | "mcp-credential"
  | "instance-admin";

/**
 * Documents HTTP endpoints that intentionally do not use the standard
 * authenticated organization/project permission chain, or that add a stronger
 * instance-wide authorization boundary.
 */
export const EndpointAccess = (mode: EndpointAccessMode) => SetMetadata(ENDPOINT_ACCESS_KEY, mode);
