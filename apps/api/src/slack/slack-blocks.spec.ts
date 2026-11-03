import { issueActionsBlock, parseActionValue, updatedAlertBlocks } from "./slack-blocks";

const projectId = "1d896420-aa61-4065-9844-31e2587c5534";
const issueId = "6a0b8f1e-3c2d-4e5f-8a9b-0c1d2e3f4a5b";

describe("Slack alert blocks", () => {
  it("round-trips the button value and rejects anything else", () => {
    const block = issueActionsBlock({ projectId, issueId, status: "open" }, true)!;
    const value = (block.elements[0] as { value: string }).value;
    expect(parseActionValue(value)).toEqual({ projectId, issueId });
    expect(parseActionValue(`${projectId}:not-a-uuid`)).toBeNull();
    expect(parseActionValue(`${projectId}:${issueId}:extra`)).toBeNull();
    expect(parseActionValue(42)).toBeNull();
  });

  it("has no actions block without a link or interactivity", () => {
    expect(issueActionsBlock({ projectId, issueId, status: "open" }, false)).toBeNull();
  });

  it("replaces the buttons and status line, keeping the rest and the issue link", () => {
    const link = "https://spicytrack.example/issues/1";
    const original = [
      { type: "section", block_id: "head", text: { type: "mrkdwn", text: "Boom" } },
      issueActionsBlock({ projectId, issueId, status: "open", link }, true)!,
    ];
    const resolved = updatedAlertBlocks(
      original,
      { projectId, issueId, status: "resolved" },
      "Resolved by Ada in SpicyTrack",
    );
    expect(resolved[0]).toBe(original[0]);
    expect(resolved[1]).toEqual({
      type: "context",
      block_id: "spicytrack_status",
      elements: [{ type: "mrkdwn", text: "Resolved by Ada in SpicyTrack" }],
    });
    const elements = (resolved[2] as { elements: Array<{ action_id: string; url?: string }> })
      .elements;
    expect(elements.map((element) => element.action_id)).toEqual([
      "spicytrack:view",
      "spicytrack:reopen",
      "spicytrack:assign_me",
    ]);
    expect(elements[0].url).toBe(link);

    // A second action replaces the status line instead of stacking another one.
    const reopened = updatedAlertBlocks(
      resolved,
      { projectId, issueId, status: "open" },
      "Reopened by Ada in SpicyTrack",
    );
    expect(reopened).toHaveLength(3);
    expect((reopened[1] as { elements: Array<{ text: string }> }).elements[0].text).toBe(
      "Reopened by Ada in SpicyTrack",
    );
  });
});
