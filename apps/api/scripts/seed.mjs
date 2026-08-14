const BASE_URL = process.env.API_BASE_URL ?? "http://localhost:3002";
const API = `${BASE_URL}/api`;

const PRIMARY_USER = {
  name: "Demo Owner",
  email: process.env.SEED_EMAIL ?? "demo@spicytrack.dev",
  password: process.env.SEED_PASSWORD ?? "demo-password-123",
};

const EXTRA_USERS = [
  {
    name: "Maya Ops",
    email: "maya.ops@spicytrack.dev",
    password: "demo-password-123",
    role: "manager",
  },
  {
    name: "Luca Backend",
    email: "luca.backend@spicytrack.dev",
    password: "demo-password-123",
    role: "developer",
  },
  {
    name: "Sana Product",
    email: "sana.product@spicytrack.dev",
    password: "demo-password-123",
    role: "viewer",
  },
];

const ORG = {
  name: "Demo Org",
  slug: "demo-org",
};

const TEAMS = [
  {
    name: "Platform",
    slug: "platform",
    description: "API, ingestion, and release infrastructure",
    members: [
      { email: "maya.ops@spicytrack.dev", role: "maintainer" },
      { email: "luca.backend@spicytrack.dev", role: "contributor" },
    ],
  },
  {
    name: "Product",
    slug: "product",
    description: "Frontend and customer-facing workflows",
    members: [{ email: "sana.product@spicytrack.dev", role: "viewer" }],
  },
];

const PROJECTS = [
  {
    name: "Backend API",
    slug: "backend-api",
    platform: "node",
    visibility: "private",
    teamSlug: "platform",
    keys: [
      { name: "Default ingest", rateLimitPerMinute: 300 },
      { name: "Canary traffic", rateLimitPerMinute: 60 },
    ],
    alerts: [
      {
        name: "New issue to email",
        triggerType: "new_issue",
        destinationType: "email",
        destinationTarget: "alerts@spicytrack.dev",
        cooldownMinutes: 15,
      },
      {
        name: "High volume webhook",
        triggerType: "event_threshold",
        threshold: 10,
        destinationType: "webhook",
        destinationTarget: `${BASE_URL}/api/health`,
        cooldownMinutes: 10,
      },
    ],
  },
  {
    name: "Checkout UI",
    slug: "checkout-ui",
    platform: "javascript",
    visibility: "private",
    teamSlug: "product",
    keys: [
      { name: "Browser SDK", rateLimitPerMinute: 500 },
      { name: "Preview environments", rateLimitPerMinute: 100 },
    ],
    alerts: [
      {
        name: "Frontend regressions",
        triggerType: "new_issue",
        destinationType: "slack",
        destinationTarget: "https://hooks.slack.com/services/T000/B000/demo",
        cooldownMinutes: 30,
      },
    ],
  },
];

const PROJECT_EVENT_TEMPLATES = {
  "backend-api": [
    {
      type: "TypeError",
      value: "Cannot read properties of undefined (reading 'map')",
      transaction: "GET /api/dashboard/widgets",
      filename: "app/dashboard/widgets.ts",
      function: "renderWidgetList",
      lineno: 42,
      level: "error",
      events: 14,
      issueStatus: "open",
      callerFrame: {
        filename: "node_modules/@nestjs/core/router/router-execution-context.js",
        function: "RouterExecutionContext.create",
        lineno: 46,
      },
      code: {
        pre: [
          "export function renderWidgetList(widgets?: Widget[]) {",
          "  const grouped = groupByCategory(widgets);",
          "",
          "  return grouped.sections",
        ],
        line: "    .map((section) => renderSection(section))",
        post: ["    .join('\\n');", "}"],
      },
      comments: [
        "Spike seen after the 1.5.0 deployment.",
        "Needs a null-guard before rendering widget groups.",
      ],
    },
    {
      type: "BadRequestException",
      value: "PAYMENT_METHOD_DECLINED",
      transaction: "POST /api/checkout/charge",
      filename: "app/checkout/charge.service.ts",
      function: "ChargeService.capture",
      lineno: 118,
      level: "error",
      events: 6,
      issueStatus: "resolved",
      callerFrame: {
        filename: "node_modules/@nestjs/core/router/router-execution-context.js",
        function: "RouterExecutionContext.create",
        lineno: 46,
      },
      code: {
        pre: [
          "  async capture(paymentIntent: PaymentIntent) {",
          "    const gateway = this.gatewayFor(paymentIntent.method);",
          "    const result = await gateway.charge(paymentIntent);",
          "",
          "    if (!result.ok) {",
        ],
        line: "      throw new BadRequestException('PAYMENT_METHOD_DECLINED');",
        post: ["    }", "", "    return result;", "  }"],
      },
      comments: ["Resolved via gateway retry fallback in 1.5.1."],
    },
    {
      type: "UnhandledPromiseRejection",
      value: "fetch failed: ECONNRESET",
      transaction: "GET /api/reports/export",
      filename: "app/reports/export.worker.ts",
      function: "ExportWorker.run",
      lineno: 27,
      level: "error",
      events: 3,
      issueStatus: "ignored",
      callerFrame: {
        filename: "node_modules/bullmq/dist/classes/worker.js",
        function: "Worker.processJob",
        lineno: 512,
      },
      code: {
        pre: ["  async run(job: ExportJob) {", "    const source = this.buildSourceUrl(job);", ""],
        line: "    const response = await fetch(source, { signal: this.abortSignal });",
        post: ["", "    return streamToStorage(response.body, job.destination);", "  }"],
      },
      comments: ["Transient upstream issue, ignored for now."],
    },
    {
      type: null,
      value: null,
      message: "Rate limit exceeded for client 203.0.113.42",
      transaction: "POST /api/ingest/webhook",
      filename: "app/ingest/webhook.controller.ts",
      function: "WebhookController.handle",
      level: "warning",
      events: 27,
      issueStatus: "open",
      comments: ["May need a higher edge limit for premium tenants."],
    },
    {
      type: "NotFoundException",
      value: "Invoice 8841 not found",
      transaction: "GET /api/billing/invoices/:id",
      filename: "app/billing/invoices.service.ts",
      function: "InvoicesService.getById",
      lineno: 55,
      level: "error",
      events: 2,
      issueStatus: "open",
      callerFrame: {
        filename: "node_modules/@nestjs/core/router/router-execution-context.js",
        function: "RouterExecutionContext.create",
        lineno: 46,
      },
      code: {
        pre: [
          "  async getById(invoiceId: string) {",
          "    const invoice = await this.repository.findOne({ id: invoiceId });",
          "",
          "    if (!invoice) {",
        ],
        line: "      throw new NotFoundException(`Invoice ${invoiceId} not found`);",
        post: ["    }", "", "    return invoice;", "  }"],
      },
      comments: ["Probably stale link from the admin portal."],
    },
  ],
  "checkout-ui": [
    {
      type: "ChunkLoadError",
      value: "Loading chunk 221 failed",
      transaction: "GET /checkout",
      filename: "assets/checkout.entry.js",
      function: "loadCheckoutApp",
      lineno: 1,
      level: "error",
      events: 19,
      issueStatus: "open",
      comments: ["Seen mostly on Safari after deploys."],
    },
    {
      type: "TypeError",
      value: "Cannot read properties of null (reading 'focus')",
      transaction: "POST /checkout/confirm",
      filename: "src/routes/checkout/confirm.tsx",
      function: "focusNextField",
      lineno: 88,
      level: "warning",
      events: 9,
      issueStatus: "resolved",
      callerFrame: {
        filename: "node_modules/react-dom/cjs/react-dom.production.js",
        function: "invokeGuardedCallback",
        lineno: 4277,
      },
      code: {
        pre: [
          "  const focusNextField = () => {",
          "    const next = formRefs.current[activeIndex + 1];",
          "",
        ],
        line: "    next.focus();",
        post: ["  };"],
      },
      comments: ["Fixed by guarding empty payment form refs."],
    },
    {
      type: null,
      value: null,
      message: "Browser extension blocked analytics request",
      transaction: "GET /pricing",
      filename: "src/lib/analytics.ts",
      function: "sendAnalyticsEvent",
      level: "info",
      events: 7,
      issueStatus: "ignored",
      comments: ["Intentional ignore: user environment interference."],
    },
  ],
};

const ENVIRONMENTS = ["production", "staging", "preview"];
const RELEASES = ["1.4.0", "1.4.1", "1.5.0", "1.5.1"];

const userTokens = new Map();

async function api(method, path, body, token, init = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
    body: body ? JSON.stringify(body) : init.body,
  });

  if (!response.ok && response.status !== 409) {
    const text = await response.text();
    throw new Error(`${method} ${path} -> ${response.status}: ${text}`);
  }

  if (response.status === 409) {
    return null;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function authenticateUser(user) {
  const registerResponse = await fetch(`${API}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: user.name,
      email: user.email,
      password: user.password,
    }),
  });

  if (registerResponse.ok) {
    const { session } = await registerResponse.json();
    return session.token;
  }

  const loginResponse = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: user.email,
      password: user.password,
    }),
  });

  if (!loginResponse.ok) {
    throw new Error(`Could not register or log in ${user.email}: ${await loginResponse.text()}`);
  }

  const { session } = await loginResponse.json();
  return session.token;
}

async function ensureOrganization(ownerToken) {
  await api("POST", "/organizations", ORG, ownerToken);
  return ORG.slug;
}

async function ensureMembers(ownerToken, orgSlug) {
  const members = [];

  for (const user of EXTRA_USERS) {
    const token = await authenticateUser(user);
    userTokens.set(user.email, token);

    const invitation = await api(
      "POST",
      `/organizations/${orgSlug}/invitations`,
      { email: user.email, role: user.role },
      ownerToken,
    );

    if (invitation?.token) {
      await api("POST", "/organizations/invitations/accept", { token: invitation.token }, token);
    }

    members.push(user);
  }

  return members;
}

async function listMembers(ownerToken, orgSlug) {
  return api("GET", `/organizations/${orgSlug}/members`, undefined, ownerToken);
}

async function ensureTeams(ownerToken, orgSlug, members) {
  const memberByEmail = new Map(members.map((member) => [member.email, member]));
  const orgMembers = await listMembers(ownerToken, orgSlug);
  const memberIdByEmail = new Map(orgMembers.map((member) => [member.email, member.userId]));

  for (const team of TEAMS) {
    await api(
      "POST",
      `/organizations/${orgSlug}/teams`,
      {
        name: team.name,
        slug: team.slug,
        description: team.description,
      },
      ownerToken,
    );

    for (const assignment of team.members) {
      const member = memberByEmail.get(assignment.email);
      const userId = memberIdByEmail.get(assignment.email);
      if (!member || !userId) {
        continue;
      }

      // Recreate the team membership so repeated seeds converge on the fixture role.
      await api(
        "DELETE",
        `/organizations/${orgSlug}/teams/${team.slug}/members/${userId}`,
        undefined,
        ownerToken,
      );

      await api(
        "POST",
        `/organizations/${orgSlug}/teams/${team.slug}/members`,
        {
          userId,
          role: assignment.role,
        },
        ownerToken,
      );
    }
  }

  const teams = await api("GET", `/organizations/${orgSlug}/teams`, undefined, ownerToken);
  return new Map(teams.map((team) => [team.slug, team]));
}

async function ensureProject(ownerToken, orgSlug, project, teamBySlug) {
  const projects = await api("GET", `/organizations/${orgSlug}/projects`, undefined, ownerToken);
  const existingProject = projects.find((item) => item.slug === project.slug);

  if (!existingProject) {
    await api(
      "POST",
      `/organizations/${orgSlug}/projects`,
      {
        name: project.name,
        platform: project.platform,
        visibility: project.visibility,
        teamId: teamBySlug.get(project.teamSlug)?.id,
      },
      ownerToken,
    );
  }

  const projectRecord = await api(
    "GET",
    `/organizations/${orgSlug}/projects/${project.slug}`,
    undefined,
    ownerToken,
  );

  const existingKeys = await api(
    "GET",
    `/organizations/${orgSlug}/projects/${project.slug}/keys`,
    undefined,
    ownerToken,
  );

  for (const key of project.keys) {
    const alreadyExists = existingKeys.some((item) => item.name === key.name);
    if (!alreadyExists) {
      await api("POST", `/organizations/${orgSlug}/projects/${project.slug}/keys`, key, ownerToken);
    }
  }

  const keys = await api(
    "GET",
    `/organizations/${orgSlug}/projects/${project.slug}/keys`,
    undefined,
    ownerToken,
  );

  return {
    ...projectRecord,
    publicKey: keys[0]?.publicKey,
  };
}

function buildEventBody(project, template, index) {
  const body = {
    event_id: cryptoRandomId(),
    level: template.level,
    platform: project.platform,
    transaction: template.transaction,
    environment: ENVIRONMENTS[index % ENVIRONMENTS.length],
    release: RELEASES[index % RELEASES.length],
  };

  if (template.type) {
    const frames = [];

    if (template.callerFrame) {
      frames.push({
        filename: template.callerFrame.filename,
        function: template.callerFrame.function,
        lineno: template.callerFrame.lineno,
        colno: 11,
        in_app: false,
      });
    }

    frames.push({
      filename: template.filename,
      function: template.function,
      lineno: template.lineno,
      colno: 5,
      in_app: true,
      ...(template.code
        ? {
            pre_context: template.code.pre,
            context_line: template.code.line,
            post_context: template.code.post,
          }
        : {}),
    });

    body.exception = {
      values: [
        {
          type: template.type,
          value: template.value,
          stacktrace: { frames },
        },
      ],
    };
  } else {
    body.message = template.message;
  }

  return body;
}

function cryptoRandomId() {
  return [...crypto.getRandomValues(new Uint8Array(16))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function ingestTemplateEvents(project, template) {
  for (let index = 0; index < template.events; index += 1) {
    const response = await fetch(
      `${BASE_URL}/api/${project.id}/store?sentry_key=${project.publicKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildEventBody(project, template, index)),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to ingest event for "${template.type ?? template.message}": ${await response.text()}`,
      );
    }
  }
}

async function seedIssues(ownerToken, orgSlug, project, members) {
  const templates = PROJECT_EVENT_TEMPLATES[project.slug] ?? [];
  const existingIssuesPage = await api(
    "GET",
    `/organizations/${orgSlug}/projects/${project.slug}/issues?page=1&pageSize=100&sortBy=firstSeenAt&sortDir=asc`,
    undefined,
    ownerToken,
  );
  const existingIssues = existingIssuesPage.items ?? [];

  if (existingIssues.length < templates.length) {
    for (const template of templates) {
      await ingestTemplateEvents(project, template);
      console.log(
        `Seeded ${template.events} events for ${project.slug} -> ${
          template.type ? `${template.type}: ${template.value}` : template.message
        }`,
      );
    }
  } else {
    console.log(
      `Skipped event ingestion for ${project.slug} because ${existingIssues.length} issues already exist`,
    );
  }

  const issuesPage = await api(
    "GET",
    `/organizations/${orgSlug}/projects/${project.slug}/issues?page=1&pageSize=100&sortBy=firstSeenAt&sortDir=asc`,
    undefined,
    ownerToken,
  );
  const issues = issuesPage.items ?? [];

  for (let index = 0; index < issues.length; index += 1) {
    const issue = issues[index];
    const template = templates[index];
    const assignee = members[index % members.length];
    const assigneeUserId = await getOrganizationUserId(ownerToken, orgSlug, assignee.email);

    if (!template || !issue) {
      continue;
    }

    if (template.issueStatus && template.issueStatus !== "open") {
      await api(
        "PATCH",
        `/organizations/${orgSlug}/projects/${project.slug}/issues/${issue.id}/status`,
        { status: template.issueStatus },
        ownerToken,
      );
    }

    if (assigneeUserId) {
      await api(
        "PATCH",
        `/organizations/${orgSlug}/projects/${project.slug}/issues/${issue.id}/assignee`,
        { assignedUserId: assigneeUserId },
        ownerToken,
      );
    }

    for (const body of template.comments ?? []) {
      await api(
        "POST",
        `/organizations/${orgSlug}/projects/${project.slug}/issues/${issue.id}/comments`,
        { body },
        ownerToken,
      );
    }
  }
}

async function getOrganizationUserId(ownerToken, orgSlug, email) {
  const members = await listMembers(ownerToken, orgSlug);
  return members.find((member) => member.email === email)?.userId;
}

async function ensureAlerts(ownerToken, orgSlug, project) {
  const existing = await api(
    "GET",
    `/organizations/${orgSlug}/projects/${project.slug}/alerts`,
    undefined,
    ownerToken,
  );

  for (const rule of project.alerts) {
    const alreadyExists = existing.some((item) => item.name === rule.name);
    if (!alreadyExists) {
      await api(
        "POST",
        `/organizations/${orgSlug}/projects/${project.slug}/alerts`,
        rule,
        ownerToken,
      );
    }
  }
}

async function ensureReleaseArtifacts(ownerToken, orgSlug, project) {
  const releaseVersion = "1.5.1";
  await api(
    "PUT",
    `/organizations/${orgSlug}/projects/${project.slug}/releases/${releaseVersion}`,
    undefined,
    ownerToken,
  );

  const existingArtifacts = await api(
    "GET",
    `/organizations/${orgSlug}/projects/${project.slug}/releases/${releaseVersion}/artifacts`,
    undefined,
    ownerToken,
  );

  if (existingArtifacts.some((artifact) => artifact.name === "app.min.js.map")) {
    return;
  }

  const form = new FormData();
  form.append(
    "file",
    new Blob(
      [
        JSON.stringify(
          {
            version: 3,
            file: "app.min.js",
            sources: ["src/app.ts"],
            names: ["renderCheckout"],
            mappings: "AAAA",
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    ),
    "app.min.js.map",
  );

  await api(
    "POST",
    `/organizations/${orgSlug}/projects/${project.slug}/releases/${releaseVersion}/artifacts`,
    undefined,
    ownerToken,
    {
      headers: {
        Authorization: `Bearer ${ownerToken}`,
      },
      body: form,
    },
  );
}

async function main() {
  const ownerToken = await authenticateUser(PRIMARY_USER);
  userTokens.set(PRIMARY_USER.email, ownerToken);
  console.log(`Authenticated as ${PRIMARY_USER.email}`);

  const orgSlug = await ensureOrganization(ownerToken);
  console.log(`Organization ready: ${orgSlug}`);

  const members = await ensureMembers(ownerToken, orgSlug);
  console.log(`Members ready: ${members.length + 1}`);

  const teamBySlug = await ensureTeams(ownerToken, orgSlug, members);
  console.log(`Teams ready: ${teamBySlug.size}`);

  for (const projectConfig of PROJECTS) {
    const project = await ensureProject(ownerToken, orgSlug, projectConfig, teamBySlug);
    console.log(`Project ready: ${project.slug} (key ${project.publicKey})`);

    await seedIssues(ownerToken, orgSlug, project, members);
    await ensureAlerts(ownerToken, orgSlug, { ...project, alerts: projectConfig.alerts });
    await ensureReleaseArtifacts(ownerToken, orgSlug, project);
  }

  console.log("\nDone. Sign in with:");
  console.log(`  email:    ${PRIMARY_USER.email}`);
  console.log(`  password: ${PRIMARY_USER.password}`);
  console.log(`  org:      /orgs/${orgSlug}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
