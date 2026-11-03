import { checksDecision } from "./autofix-job.handler";
import { summarizeChecks } from "../integrations/vcs/vcs-provider.interface";

const startedAt = new Date("2026-11-03T10:00:00Z");
const deadlineAt = new Date("2026-11-03T11:00:00Z");
const at = (minutes: number) => new Date(startedAt.getTime() + minutes * 60_000);

describe("summarizeChecks", () => {
  it("reports none, pending, failure and success", () => {
    expect(summarizeChecks([]).state).toBe("none");
    expect(
      summarizeChecks([
        { name: "lint", state: "success" },
        { name: "test", state: "pending" },
      ]),
    ).toEqual({ state: "pending", total: 2, failed: [], pending: ["test"] });
    expect(
      summarizeChecks([
        { name: "test", state: "pending" },
        { name: "build", state: "failure" },
      ]).state,
    ).toBe("failure");
    expect(summarizeChecks([{ name: "test", state: "success" }]).state).toBe("success");
  });
});

describe("checksDecision", () => {
  const base = { requirePassingChecks: true, startedAt, deadlineAt };

  it("opens a verified pull request once every check passed", () => {
    expect(
      checksDecision(summarizeChecks([{ name: "test", state: "success" }]), {
        ...base,
        now: at(3),
      }),
    ).toEqual({ outcome: "open_pr", verified: true });
  });

  it("fails without a pull request when a check failed", () => {
    const decision = checksDecision(
      summarizeChecks([
        { name: "unit tests", state: "failure" },
        { name: "lint", state: "pending" },
      ]),
      { ...base, now: at(3) },
    );
    expect(decision).toEqual({
      outcome: "fail",
      reason: "CI failed on the autofix branch (unit tests). No pull request was opened.",
    });
  });

  it("keeps waiting while checks run or before CI had time to report", () => {
    expect(
      checksDecision(summarizeChecks([{ name: "test", state: "pending" }]), {
        ...base,
        now: at(30),
      }),
    ).toBeNull();
    expect(checksDecision(summarizeChecks([]), { ...base, now: at(2) })).toBeNull();
  });

  it("requires CI by default when none reported", () => {
    expect(checksDecision(summarizeChecks([]), { ...base, now: at(6) })).toMatchObject({
      outcome: "fail",
    });
  });

  it("opens an unverified pull request when the project does not require CI", () => {
    expect(
      checksDecision(summarizeChecks([]), { ...base, requirePassingChecks: false, now: at(6) }),
    ).toEqual({ outcome: "open_pr", verified: false });
  });

  it("gives up at the deadline", () => {
    expect(
      checksDecision(summarizeChecks([{ name: "e2e", state: "pending" }]), {
        ...base,
        now: at(60),
      }),
    ).toMatchObject({ outcome: "fail", reason: expect.stringContaining("still pending: e2e") });
  });
});
