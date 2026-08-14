export const POST_INGEST_ADMIN_JOB_TYPE = "post_ingest_admin";

export type PostIngestAdminJobPayload = {
  organizationId: string;
  projectId: string;
  issueId: string;
  eventId: string;
  issueTitle: string;
  issueStatus: string;
  timesSeen: number;
  issueWasCreated: boolean;
  issueRegressed?: boolean;
};
