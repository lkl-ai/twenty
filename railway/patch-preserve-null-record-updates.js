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

const preservesExplicitNull = () => {
  delete require.cache[require.resolve(target)];

  const { removeUndefinedFromRecord } = require(target);
  const result = removeUndefinedFromRecord({
    explicitNull: null,
    omitted: undefined,
    nested: {
      explicitNull: null,
      omitted: undefined,
    },
  });

  return (
    Object.hasOwn(result, 'explicitNull') &&
    result.explicitNull === null &&
    !Object.hasOwn(result, 'omitted') &&
    Object.hasOwn(result, 'nested') &&
    Object.hasOwn(result.nested, 'explicitNull') &&
    result.nested.explicitNull === null &&
    !Object.hasOwn(result.nested, 'omitted')
  );
};

if (preservesExplicitNull()) {
  console.log(`${target} already preserves explicit null values`);
  process.exit(0);
}

const buggyCondition =
  /if\s*\(\s*!\s*(?:(?:\(\s*0\s*,\s*[\w$.]*isDefined\s*\))|[\w$.]*isDefined)\s*\(\s*value\s*\)\s*\)\s*\{/;
const fixedCondition = 'if (value === undefined) {';

if (!buggyCondition.test(source)) {
  throw new Error(
    `${target} strips explicit null values but does not contain the expected buggy implementation`,
  );
}

fs.writeFileSync(target, source.replace(buggyCondition, fixedCondition));

if (!preservesExplicitNull()) {
  throw new Error(`${target} still strips explicit null values after patching`);
}

console.log(`Patched ${target} to preserve explicit null values`);
