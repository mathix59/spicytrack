import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { JobsService } from "../jobs/jobs.service";

@Injectable()
export class OrganizationsJobsService {
  constructor(private readonly jobsService: JobsService) {}

  async getQueueOverview(
    organizationId: string,
    filters: {
      status?: "pending" | "running" | "failed";
      type?: string;
      projectId?: string;
      limit?: number;
    },
  ) {
    const [summary, jobs] = await Promise.all([
      this.jobsService.getOrganizationQueueSummary(organizationId),
      this.jobsService.listOrganizationRecentJobs(organizationId, filters),
    ]);

    return { summary, jobs };
  }

  async requeueFailedJob(organizationId: string, jobId: string) {
    const job = await this.jobsService.requeueFailedOrganizationJob(organizationId, jobId);

    if (job) {
      return job;
    }

    const candidates = await this.jobsService.listOrganizationRecentJobs(organizationId, {
      limit: 100,
    });
    const existing = candidates.find((candidate) => candidate.id === jobId);

    if (!existing) {
      throw new NotFoundException("Job not found");
    }

    throw new ConflictException("Only failed jobs can be requeued");
  }
}
