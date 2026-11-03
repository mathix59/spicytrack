import { createHmac } from "node:crypto";

import { discordMessage, pagerDutyEvent, slackMessage, webhookSignature } from "./alert-formats";
import type { AlertPayload } from "./alerts.types";

const issueAlert: AlertPayload = {
  triggerType: "regression",
  projectId: "project-1",
  projectName: "Backend <API>",
  issueId: "issue-1",
  issueUrl: "https://spicytrack.example/orgs/o/projects/p/issues/issue-1",
  issueTitle: "TypeError: x is undefined",
  culprit: "app/checkout.ts in submit",
  level: "fatal",
  environment: "production",
  release: "api@2.0",
  timesSeen: 42,
  userCount: 7,
};

describe("slackMessage", () => {
  it("builds Block Kit with a link, facts and a fallback text", () => {
    const message = slackMessage(issueAlert, "fallback");
    expect(message.text).toBe("fallback");
    const [headline, facts, actions] = message.blocks as Array<Record<string, any>>;
    expect(headline.text.text).toContain("*Regression*");
    expect(headline.text.text).toContain(`<${issueAlert.issueUrl}|TypeError: x is undefined>`);
    expect(headline.text.text).toContain("`app/checkout.ts in submit`");
    expect(facts.fields.map((field: { text: string }) => field.text)).toEqual([
      "*Project*\nBackend &lt;API&gt;",
      "*Level*\nfatal",
      "*Environment*\nproduction",
      "*Release*\napi@2.0",
      "*Events*\n42",
      "*Users*\n7",
    ]);
    expect(actions.elements[0].url).toBe(issueAlert.issueUrl);
  });

  it("summarises a daily digest", () => {
    const message = slackMessage(
      {
        triggerType: "daily_digest",
        projectId: "p",
        projectName: "Web",
        eventCount24h: 12,
        newIssueCount24h: 2,
        openRegressionCount: 1,
        topRegressions: [{ title: "Boom", timesSeen: 9 }],
      },
      "fallback",
    );
    const blocks = message.blocks as Array<Record<string, any>>;
    expect(blocks[0].text.text).toBe("Daily digest: Web");
    expect(blocks[1].text.text).toContain("• Boom (9 events)");
  });
});

describe("discordMessage", () => {
  it("sends one embed coloured by trigger, without pinging anyone", () => {
    const message = discordMessage(issueAlert);
    const [embed] = message.embeds;
    expect(embed).toMatchObject({
      author: { name: "Regression" },
      title: "TypeError: x is undefined",
      url: issueAlert.issueUrl,
      color: 0xf76b15,
    });
    expect("fields" in embed && embed.fields).toContainEqual({
      name: "Users",
      value: "7",
      inline: true,
    });
    expect("allowed_mentions" in message && message.allowed_mentions).toEqual({ parse: [] });
  });
});

describe("pagerDutyEvent", () => {
  it("triggers one incident per issue with a mapped severity", () => {
    const event = pagerDutyEvent(issueAlert, "R".repeat(32));
    expect(event).toMatchObject({
      routing_key: "R".repeat(32),
      event_action: "trigger",
      dedup_key: "spicytrack-issue-issue-1",
      payload: {
        summary: "Regression: TypeError: x is undefined",
        source: "Backend <API>",
        severity: "critical",
        component: "app/checkout.ts in submit",
        group: "production",
      },
      links: [{ href: issueAlert.issueUrl, text: "View issue in SpicyTrack" }],
    });
  });

  it("defaults to error severity when the level is unknown", () => {
    expect(pagerDutyEvent({ ...issueAlert, level: undefined }, "k").payload.severity).toBe("error");
  });
});

describe("webhookSignature", () => {
  it("signs the timestamp and raw body like Stripe", () => {
    const body = JSON.stringify({ hello: "world" });
    const expected = createHmac("sha256", "whsec_test").update(`1700000000.${body}`).digest("hex");
    expect(webhookSignature("whsec_test", body, 1_700_000_000)).toBe(`t=1700000000,v1=${expected}`);
  });
});
