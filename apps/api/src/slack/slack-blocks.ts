/** Block ids SpicyTrack owns inside an alert message, so updates replace them in place. */
export const SLACK_ACTIONS_BLOCK = "spicytrack_actions";
export const SLACK_STATUS_BLOCK = "spicytrack_status";
export const SLACK_ACTION_PREFIX = "spicytrack:";

export const SLACK_ISSUE_ACTIONS = ["resolve", "ignore", "reopen", "assign_me"] as const;
export type SlackIssueAction = (typeof SLACK_ISSUE_ACTIONS)[number];

type IssueState = { projectId: string; issueId: string; status: string; link?: string };

function button(action: SlackIssueAction, label: string, state: IssueState) {
  return {
    type: "button",
    action_id: `${SLACK_ACTION_PREFIX}${action}`,
    text: { type: "plain_text", text: label },
    value: `${state.projectId}:${state.issueId}`,
  };
}

/** "View issue", then the actions that make sense for the issue's status. */
export function issueActionsBlock(state: IssueState, interactive: boolean) {
  const elements: Array<Record<string, unknown>> = [];
  if (state.link) {
    elements.push({
      type: "button",
      action_id: `${SLACK_ACTION_PREFIX}view`,
      style: "primary",
      text: { type: "plain_text", text: "View issue" },
      url: state.link,
    });
  }
  if (interactive) {
    if (state.status === "open") {
      elements.push(button("resolve", "Resolve", state), button("ignore", "Ignore", state));
    } else {
      elements.push(button("reopen", "Reopen", state));
    }
    elements.push(button("assign_me", "Assign to me", state));
  }
  return elements.length > 0 ? { type: "actions", block_id: SLACK_ACTIONS_BLOCK, elements } : null;
}

/** Parses a button value written by `issueActionsBlock`. */
export function parseActionValue(value: unknown): { projectId: string; issueId: string } | null {
  if (typeof value !== "string") return null;
  const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
  const match = value.match(new RegExp(`^(${uuid}):(${uuid})$`, "i"));
  return match ? { projectId: match[1], issueId: match[2] } : null;
}

/**
 * The alert message after an action: the same blocks, with the buttons for the new status and a
 * line saying who did what.
 */
export function updatedAlertBlocks(
  blocks: Array<Record<string, unknown>>,
  state: IssueState,
  statusLine: string,
) {
  const kept = blocks.filter(
    (block) => block.block_id !== SLACK_ACTIONS_BLOCK && block.block_id !== SLACK_STATUS_BLOCK,
  );
  const original = blocks.find((block) => block.block_id === SLACK_ACTIONS_BLOCK) as
    | { elements?: Array<{ url?: unknown }> }
    | undefined;
  const link = original?.elements?.find((element) => typeof element.url === "string")?.url as
    | string
    | undefined;
  const actions = issueActionsBlock({ ...state, link: link ?? state.link }, true);
  return [
    ...kept,
    {
      type: "context",
      block_id: SLACK_STATUS_BLOCK,
      elements: [{ type: "mrkdwn", text: statusLine }],
    },
    ...(actions ? [actions] : []),
  ];
}
