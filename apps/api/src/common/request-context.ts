import { organizations, organizationMembers, projects, teams, users } from "../database/schema";

export type UserRecord = typeof users.$inferSelect;
export type OrganizationRecord = typeof organizations.$inferSelect;
export type OrganizationMemberRecord = typeof organizationMembers.$inferSelect;
export type ProjectRecord = typeof projects.$inferSelect;
export type TeamRecord = typeof teams.$inferSelect;

export interface AuthContext {
  user: UserRecord;
}

export interface OrganizationContext {
  organization: OrganizationRecord;
  membership: OrganizationMemberRecord;
}

export interface RequestContext {
  auth?: AuthContext;
  organization?: OrganizationContext;
  project?: ProjectRecord;
}
