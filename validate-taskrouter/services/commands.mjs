import * as core from "@actions/core";
import { exit } from "process";
import color from "ansi-colors";

const githubActions = process.env.GITHUB_ACTIONS === "true";

const maskedValues = [];

const applyMasks = (text) => {
  let maskedText = text;

  for (const mask of maskedValues) {
    maskedText = maskedText.replaceAll(mask, "***");
  }

  return maskedText;
};

const isMasked = (text) => maskedValues.some((v) => text.includes(v));

export const commands = {
  logError: (message) => {
    if (githubActions) {
      core.error(message);
    } else {
      const logMessage = applyMasks(message);
      console.error(color.red(logMessage));
    }
  },

  logWarning: (message) => {
    if (githubActions) {
      core.warning(message);
    } else {
      const logMessage = color.yellow(applyMasks(message));
      console.warn(logMessage);
    }
  },

  logInfo: (message, textColor) => {
    const logMessage = textColor ? color[textColor](message) : message;

    if (githubActions) {
      core.info(logMessage);
    } else {
      console.log(applyMasks(logMessage));
    }
  },

  logDebug: (message) => {
    if (githubActions) {
      core.debug(message);
    } else {
      if (process.env.DEBUG_MODE === "true") {
        const logMessage = applyMasks(message);
        console.log(color.gray(`[DEBUG] ${logMessage}`));
      }
    }
  },

  startLogGroup: (groupName) => {
    if (githubActions) {
      core.startGroup(groupName);
    } else {
      console.log(color.gray(`===== ${groupName} =====`));
    }
  },

  endLogGroup: () => {
    if (githubActions) {
      core.endGroup();
    } else {
      console.log(color.gray("====="));
    }
  },

  getInput: (inputName, secret = false) => {
    if (githubActions) {
      let value = core.getInput(inputName);

      if (!value) {
        value = process.env[inputName]?.trim();
      }

      if (!value) {
        core.error(
          `Missing variable '${inputName}'. Add to either Action Inputs or Environment Variables`,
        );

        exit(1);
      }

      if (secret) {
        commands.maskValue(value);
      }

      return value;
    } else {
      const value = process.env[inputName]?.trim();

      if (value) {
        if (secret) {
          commands.maskValue(value);
        }

        return value;
      }

      console.error(color.red(`Missing Environment Variable: ${inputName}`));

      exit(1);
    }
  },

  getOptionalInput: (inputName) => {
    if (githubActions) {
      return core.getInput(inputName) || process.env[inputName];
    }

    return process.env[inputName];
  },

  maskValue: (value) => {
    if (githubActions) {
      core.setSecret(value);
    } else {
      maskedValues.push(value);
    }
  },

  setOutput: (outputKey, value) => {
    if (githubActions) {
      core.setOutput(outputKey, value);
    } else {
      if (isMasked(value)) {
        console.warn(`Output '${outputKey}' tried to output a masked value.`);
        return;
      }

      console.log(`export ${outputKey}=${value}`);
    }
  },

  setFailed: (message) => {
    if (githubActions) {
      core.setFailed(message);
      exit();
    } else {
      console.error(color.red(applyMasks(message)));

      exit(1);
    }
  },

  addSummaryHeader: async (header) => {
    if (githubActions) {
      core.summary.addRaw(`## ${header}`);
    } else {
      console.log(`## ${color.gray(header)}`);
    }
  },

  addSummaryTable: (rows) => {
    if (!rows.length) {
      return;
    }

    if (githubActions) {
      const headings = Object.keys(rows[0]);

      const headerRow = headings.map((h) => ({
        header: true,
        data: h,
      }));

      const dataRows = rows.map((row) =>
        headings.map((h) => row[h] ?? "Unknown"),
      );

      core.summary.addTable([headerRow, ...dataRows]);
    } else {
      console.table(rows);
    }
  },

  writeSummary: async () => {
    if (githubActions) {
      await core.summary.write();
    }
  },
};
