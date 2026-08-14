import { getOctokit } from "@actions/github";
import { commands } from "./commands.mjs";
import { exit } from "process";

const GH_FILE_MODE = "100644";

export const GithubService = (ghToken) => {
  const octokit = getOctokit(ghToken).rest;

  const {
    GITHUB_REPOSITORY,
    GITHUB_ACTOR,
    GITHUB_SERVER_URL,
    GITHUB_REF_NAME,
    GITHUB_SHA,
    GITHUB_RUN_ID,
  } = process.env;

  const [owner, repo] = GITHUB_REPOSITORY.split("/");

  return {
    commitFiles: async (files, branch, message) => {
      commands.logDebug(
        `GithubService: Commit files '${files
          .map((f) => f.path)
          .join(",")}' to '${branch}'`
      );

      const fileListTree = files.map((f) => ({
        path: f.path,
        mode: GH_FILE_MODE,
        content: f.content,
      }));

      const latestCommit = await octokit.git.getCommit({
        owner,
        repo,
        commit_sha: GITHUB_SHA,
      });

      const treeSha = latestCommit.data.tree.sha;

      commands.logDebug(
        `...Get tree ${treeSha} from commit ${GITHUB_SHA}`
      );

      const newTree = await octokit.git.createTree({
        owner,
        repo,
        tree: fileListTree,
        base_tree: treeSha,
      });

      commands.logDebug(
        `...Created tree ${newTree.data.sha} under parent ${treeSha}`
      );

      const newCommit = await octokit.git.createCommit({
        owner,
        repo,
        tree: newTree.data.sha,
        message,
        parents: [GITHUB_SHA],
        author: {
          name: GITHUB_ACTOR,
          email: `${GITHUB_ACTOR}@users.noreply.github.com`,
        },
      });

      commands.logDebug(
        `...Created commit ${newCommit.data.sha} under ${branch}`
      );

      await octokit.git.createRef({
        owner,
        repo,
        sha: newCommit.data.sha,
        ref: `refs/heads/${branch}`,
      });

      commands.logDebug(
        `...Created ref ${newCommit.data.sha} under refs/heads/${branch}`
      );
    },

    openPullRequest: async (branch, title, body) => {
      commands.logDebug(
        `GithubService: Open PR '${title}' at '${branch}'`
      );

      const pullRequest = await octokit.pulls.create({
        owner,
        repo,
        head: branch,
        base: GITHUB_REF_NAME,
        title,
        body: `${body}\n\nGenerated from run: ${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`,
      });

      commands.logInfo(
        `Created Pull Request: ${pullRequest.data.html_url}`
      );
    },

    getFileContent: async (path, tag) => {
      commands.logDebug(
        `GithubService: Get File '${path}' at '${tag}'`
      );

      try {
        const contentResponse =
          await octokit.repos.getContent({
            owner,
            repo,
            path,
            ref: tag,
          });

        const content = Buffer.from(
          contentResponse.data.content,
          "base64"
        ).toString();

        return content;
      } catch (err) {
        commands.logError(
          `GithubService: Failed to get file content - ${err}`
        );

        commands.setFailed(
          `Failed to retrieve file content for ${path}`
        );

        exit(1);
      }
    },
  };
};
