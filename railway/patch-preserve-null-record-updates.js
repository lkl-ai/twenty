const fs = require('fs');
const path = require('path');

const root =
  process.env.TWENTY_SERVER_DIST_ROOT || '/app/packages/twenty-server/dist';
const targetFileName = 'remove-undefined-from-record.util.js';

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
const fixedCondition = 'if (value === undefined) {';

if (source.includes(fixedCondition)) {
  console.log(`${target} already preserves explicit null values`);
  process.exit(0);
}

const buggyCondition = 'if (!(0, utils_1.isDefined)(value)) {';

if (!source.includes(buggyCondition)) {
  throw new Error(`${target} does not contain the expected null-stripping code`);
}

fs.writeFileSync(target, source.replace(buggyCondition, fixedCondition));
console.log(`Patched ${target} to preserve explicit null values`);
