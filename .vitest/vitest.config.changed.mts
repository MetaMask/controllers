import { createRootConfig } from '../tests/vitest/create-root-config.ts';
export default await createRootConfig([
  'packages/base-controller',
  'packages/bridge-controller',
  'packages/eth-json-rpc-provider',
  'packages/wallet-framework-docs',
]);
