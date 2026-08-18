// @ts-nocheck
import { approveAll, CopilotClient, defineTool } from "@github/copilot-sdk";
import { appendFile } from "node:fs/promises";

const addToJobSummary = async (text) => {
  if (!GITHUB_STEP_SUMMARY) return;

  await appendFile(GITHUB_STEP_SUMMARY, `${text}\n`);
};

const {
  VALIDATION_RECOMMENDATIONS,
  GITHUB_TOKEN,
  GITHUB_REPOSITORY,
  GITHUB_SERVER_URL = "https://github.com",
  GITHUB_RUN_ID,
  GITHUB_STEP_SUMMARY,
} = process.env;

if (!VALIDATION_RECOMMENDATIONS) {
  console.log("No Flex plugin validation recommendations found.");
  process.exit(0);
}

if (!GITHUB_TOKEN) {
  throw new Error("GITHUB_TOKEN is required.");
}

if (!GITHUB_REPOSITORY) {
  throw new Error("GITHUB_REPOSITORY is required.");
}

const repository = GITHUB_REPOSITORY;

const createGitHubIssue = defineTool("create_github_issue", {
  description:
    "Create a GitHub issue for an actionable Twilio Flex plugin validation recommendation.",

  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "A concise title describing the Flex validation issue.",
      },
      body: {
        type: "string",
        description:
          "A clear description of the validator recommendation, why it matters, and a possible fix.",
      },
      recommendation: {
        type: "string",
        description:
          "The exact original validator recommendation this issue represents.",
      },
    },
    required: ["title", "body", "recommendation"],
  },

  handler: async ({ title, body, recommendation }) => {
    console.log(`Checking for existing GitHub issue: ${title}`);

    const existingIssuesResponse = await fetch(
      `https://api.github.com/repos/${repository}/issues?state=open&per_page=100`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      }
    );

    if (!existingIssuesResponse.ok) {
      const error = await existingIssuesResponse.text();

      throw new Error(
        `Failed to check existing GitHub issues: ${existingIssuesResponse.status} ${error}`
      );
    }

    const existingIssues = await existingIssuesResponse.json();

    const duplicateIssue = existingIssues.find(
      (issue) =>
        !issue.pull_request &&
        issue.body?.includes(recommendation)
    );

    if (duplicateIssue) {
      console.log(
        `Issue already exists #${duplicateIssue.number}: ${duplicateIssue.html_url}`
      );

      await addToJobSummary(
        `🤖 Copilot: Issue already exists [#${duplicateIssue.number}](${duplicateIssue.html_url}) — no duplicate created.`
      );

      return {
        created: false,
        issueNumber: duplicateIssue.number,
        issueUrl: duplicateIssue.html_url,
      };
    }

    console.log(`Creating GitHub issue: ${title}`);

    const response = await fetch(
      `https://api.github.com/repos/${repository}/issues`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          body: `## Validator recommendation

          ${recommendation}

          ${body}`,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();

      throw new Error(
        `Failed to create GitHub issue: ${response.status} ${error}`
      );
    }

    const issue = await response.json();

    console.log(`Created GitHub issue #${issue.number}: ${issue.html_url}`);

    await addToJobSummary(
      `🤖 Copilot: Created GitHub issue [#${issue.number}](${issue.html_url}) — ${title}`
    );

    return {
      created: true,
      issueNumber: issue.number,
      issueUrl: issue.html_url,
    };
  },
});

const client = new CopilotClient();

try {
  await client.start();

  const session = await client.createSession({
    model: "gpt-5.6-luna",
    onPermissionRequest: approveAll,

    systemMessage: {
      content: `
      You are reviewing recommendations produced by the Twilio Flex Plugin validator.

      Your job is to:

      1. Understand the validator recommendation.
      2. Explain clearly what is wrong.
      3. Explain the potential impact.
      4. Suggest a practical fix for a developer.
      5. Create a GitHub issue using the create_github_issue tool.

      The GitHub issue should contain:

      - A concise title.
      - Do not include the original validator recommendation in the generated body because it will be added automatically.
      - A simple explanation of the problem.
      - A suggested fix.
      - A link to the GitHub Actions workflow run if one is available.

      Do not invent problems that are not present in the validator output.

      Create an issue only for actionable validator recommendations.
      `,
    },

    tools: [createGitHubIssue],
  });

  const workflowRunUrl = // this is the URL to the GitHub Actions workflow run that produced the recommendations
    GITHUB_RUN_ID && GITHUB_SERVER_URL
      ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
      : "Not available";

  await session.sendAndWait({
    prompt: `
    Analyse the following Twilio Flex Plugin validator recommendations.

    Validator output:

    ${VALIDATION_RECOMMENDATIONS}

    Repository:
    ${GITHUB_REPOSITORY}

    Workflow run:
    ${workflowRunUrl}

    For each actionable recommendation, use the create_github_issue tool to create an appropriate GitHub issue.
    `,
  });
} finally {
  await client.stop();
}