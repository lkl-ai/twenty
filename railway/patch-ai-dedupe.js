const fs = require('fs');
const path = require('path');

const root =
  process.env.TWENTY_SERVER_DIST_ROOT || '/app/packages/twenty-server/dist';
const targetFileName = 'finalize-dangling-tool-parts.util.js';

const findTarget = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const found = findTarget(fullPath);

      if (found) {
        return found;
      }
    }

    if (entry.isFile() && entry.name === targetFileName) {
      return fullPath;
    }
  }

  return undefined;
};

const target = findTarget(root);

if (!target) {
  throw new Error(`Could not find ${targetFileName} under ${root}`);
}

const source = fs.readFileSync(target, 'utf8');

if (source.includes('seenToolCallIds')) {
  console.log(`${target} already contains duplicate tool-call protection`);
  process.exit(0);
}

if (!source.includes('Tool execution was interrupted.')) {
  throw new Error(`${target} does not look like the expected Twenty utility`);
}

const patched = `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.finalizeDanglingToolParts = void 0;
const ai_1 = require("ai");
const INTERRUPTED_TOOL_ERROR_TEXT = 'Tool execution was interrupted.';
const finalizeDanglingToolParts = (parts) => {
    const seenToolCallIds = new Set();
    return parts
        .filter((part) => !((0, ai_1.isToolUIPart)(part) && part.state === 'input-streaming'))
        .flatMap((part) => {
        if (!(0, ai_1.isToolUIPart)(part)) {
            return [part];
        }
        if (seenToolCallIds.has(part.toolCallId)) {
            return [];
        }
        seenToolCallIds.add(part.toolCallId);
        if (part.state === 'input-available') {
            return [
                {
                    ...part,
                    state: 'output-error',
                    input: part.input ?? {},
                    errorText: INTERRUPTED_TOOL_ERROR_TEXT,
                },
            ];
        }
        if (part.state === 'output-error' && part.input == null) {
            return [
                {
                    ...part,
                    input: {},
                },
            ];
        }
        return [part];
    });
};
exports.finalizeDanglingToolParts = finalizeDanglingToolParts;
`;

fs.writeFileSync(target, patched);
console.log(`Patched ${target}`);
