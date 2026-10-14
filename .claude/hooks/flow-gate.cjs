// UserPromptSubmit hook: injects the agentic-flow protocol into each turn's context.
// Emits the Claude Code hook JSON envelope with the protocol markdown as additionalContext.
const fs = require("fs");
const path = require("path");

const protocol = fs.readFileSync(path.join(__dirname, "flow-protocol.md"), "utf8");

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: protocol,
    },
  }),
);
