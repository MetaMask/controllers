process.argv.push('--coverage', '--merge-reports');

const { createRootConfig } = await import(
  '../tests/vitest/create-root-config.ts'
);

const changedPaths = [
  'packages/base-controller',
  'packages/bridge-controller',
  'packages/eth-json-rpc-provider',
  'packages/wallet-framework-docs',
];

console.log('--- .vitest/vitest.config.changed.mts ---');
console.log(
  `import { createRootConfig } from '../tests/vitest/create-root-config.js'; export default createRootConfig(${JSON.stringify(changedPaths)});`,
);
console.log('--- resolved config ---');
console.log(JSON.stringify(await createRootConfig(changedPaths), null, 2));
