import { Injectable } from "@nestjs/common";
import { GithubProvider } from "./github.provider";
import { GitlabProvider } from "./gitlab.provider";
import { VcsProvider, VcsProviderKind } from "./vcs-provider.interface";

@Injectable()
export class VcsFactory {
  constructor(
    private readonly github: GithubProvider,
    private readonly gitlab: GitlabProvider,
  ) {}

  getProvider(kind: VcsProviderKind): VcsProvider {
    return kind === "github" ? this.github : this.gitlab;
  }
}
