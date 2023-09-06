"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@actions/core");
const github_1 = require("@actions/github");
const getIssueDetails_1 = __importDefault(require("./controllers/issues/getIssueDetails"));
//@ts-expect-error
const adf2md = __importStar(require("adf-to-md"));
const octokit = (0, github_1.getOctokit)((0, core_1.getInput)("GITHUB_TOKEN"));
async function getDescription(description) {
    try {
        return adf2md.convert(description).result;
    }
    catch {
        return `*No description available.*`;
    }
}
;
async function execute(storyKey) {
    console.debug("Getting the story detail from Jira...");
    const issueDetails = await (0, getIssueDetails_1.default)(storyKey);
    const description = getDescription(issueDetails.fields.description);
    if ((0, core_1.getInput)("JIRA_KEY_MULTIPLE") !== "") {
        (0, core_1.setOutput)("title", issueDetails.fields.summary);
        (0, core_1.setOutput)("description", description);
    }
    if (github_1.context.payload.pull_request) {
        if ((0, core_1.getInput)("DISABLE_PULL_REQUEST_COMMENT") !== "") {
            console.info("Not creating or update any comments because DISABLE_PULL_REQUEST_COMMENT is true.");
            return;
        }
        console.debug("Checking for existing story comment...");
        const comments = await octokit.rest.issues.listComments({
            ...github_1.context.repo,
            issue_number: github_1.context.payload.pull_request.number
        });
        const existingComment = comments.data.find((comment) => {
            if (!comment.body)
                return false;
            const lines = comment.body.split('\n');
            if (!lines.length)
                return false;
            if (!lines[0].startsWith(`## [${issueDetails.key}]`))
                return false;
            if (!lines[1].startsWith("###"))
                return false;
            return true;
        });
        const body = [
            `## [${issueDetails.key}](${(0, core_1.getInput)("JIRA_BASE_URL")}/browse/${issueDetails.key})`,
            `### ${issueDetails.fields.summary}`,
            description
        ].join('\n');
        if (existingComment) {
            console.debug("Existing comment exists for story.");
            if (existingComment.body === body) {
                console.info("Skipping updating previous comment because content is the same.");
                return;
            }
            await octokit.rest.issues.updateComment({
                ...github_1.context.repo,
                comment_id: existingComment.id,
                body
            });
        }
        else {
            console.debug("Creating a new comment with story summary...");
            await octokit.rest.issues.createComment({
                ...github_1.context.repo,
                issue_number: github_1.context.payload.pull_request.number,
                body
            });
        }
    }
}
;
async function init() {
    const jiraKey = (0, core_1.getInput)("JIRA_KEY");
    if (!jiraKey.includes('-')) {
        if (!github_1.context.payload.pull_request)
            return (0, core_1.setFailed)("Partial Jira key can only be used in pull requests!");
        const pullRequest = await octokit.rest.pulls.get({
            ...github_1.context.repo,
            pull_number: github_1.context.payload.pull_request.number,
        });
        const inputs = [
            pullRequest.data.head.ref,
            pullRequest.data.title,
            pullRequest.data.body
        ];
        const regex = new RegExp(`${jiraKey}-([0-9]{1,6})`, 'g');
        const storyKeys = [];
        for (let input of inputs) {
            const matches = regex.exec(input ?? "");
            if (matches?.length) {
                storyKeys.push(matches[0]);
                continue;
            }
        }
        if (!storyKeys.length) {
            if ((0, core_1.getInput)("JIRA_PARTIAL_KEY_SILENT_FAILURE") !== "") {
                console.error("Failed to find a Jira key starting with " + jiraKey);
                console.info("Executing silent error because JIRA_PARTIAL_KEY_SILENT_FAILURE is true.");
            }
            else
                (0, core_1.setFailed)("Failed to find a Jira key starting with " + jiraKey);
            return;
        }
        if ((0, core_1.getInput)("JIRA_KEY_MULTIPLE") !== "") {
            for (let storyKey of storyKeys)
                execute(storyKey);
        }
        else
            execute(storyKeys[0]);
    }
    else
        execute(jiraKey);
}
;
try {
    init();
}
catch (error) {
    if (error instanceof Error || typeof error === "string")
        (0, core_1.setFailed)(error);
    else
        (0, core_1.setFailed)("Unknown error: " + error);
}
//# sourceMappingURL=index.js.map