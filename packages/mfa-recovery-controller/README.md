# `@metamask/mfa-recovery-controller`

Coordinates MFA recovery through injected auth and escrow providers.

Pending mutations are encrypted in controller state. `resume()` completes them;
`abort()` is allowed only before writing. See [Architecture](ARCHITECTURE.md).

## Auth API Integration

Configure `AuthApiRecoveryAuthProvider` with a messenger that can call
`AuthenticationController:refreshCanonicalProfileId` and
`AuthenticationController:requestMfaApproval`. It resolves the current canonical
profile id for each mutation and requests approvals from `/api/v2/mfa/approvals`. Writes and reads require a
request-bound AAL2 approval; updates and reads also require an identifier proof.
Without a recent MFA verification, approvals reject with `StepUpRequiredError`:
verify, then call `resume()` or retry the read.

`register` and `updateIdentifiers` send the approval's `identifiers` to each
escrow as `approvedIdentifiers`; the escrow rejects payload identifiers outside
that list. Build payload identifiers from those entries unchanged (verifier
included): the controller rejects any other identifier before writing, and the
mutation can then be aborted. Set `CubistEscrowProviderOptions.authAudience` to the escrow's
`AUTH_CONTROLLER_AUDIENCE`.

## Seedless password unlock

For a social login that unlocks a seedless vault with a password, provide
`RecoveryIdentifierAuthProvider.getKeyBoundIdentifierLogin`. It must perform
one AAL1 social login and return both the key-bound recovery token and the
auth-server token set. Mobile then calls:

```typescript
const { session, seedlessAuthData } =
  await mfaRecoveryController.authenticateIdentifier(identifier, {
    requireSeedlessAuthData: true,
  });

const { authConnection, ...seedlessAuthFields } = seedlessAuthData;
await seedlessOnboardingController.authenticate({
  ...seedlessAuthFields,
  // Values match `AuthConnection`; cast if your TS treats string enums nominally.
  authConnection: authConnection as AuthConnection,
});
// Prompt for the password, evaluate TOPRF, and decrypt the vault.
// Keep `session` only if a later getRecoverySecret is needed; drop seedlessAuthData.
```

With `requireSeedlessAuthData: true`, the result always includes
`seedlessAuthData` (including `revokeToken`) beside a key-bound `session`.
`authConnection` must match the social identifier's issuer namespace and uses
the same string values as seedless `AuthConnection`. Cast to `AuthConnection`
if TypeScript treats that enum nominally. Pass only `session` to
`getRecoverySecret(session)` later — do not keep auth-server tokens on the
session object.

The seedless auth data comes only from the AAL1 social login and is never sent
to recovery escrows. `getRecoverySecret` separately requests its AAL2
approval when a recovery-secret read is needed.

## Installation

`yarn add @metamask/mfa-recovery-controller`

or

`npm install @metamask/mfa-recovery-controller`

## Contributing

This package is part of a monorepo. Instructions for contributing can be found in the [monorepo README](https://github.com/MetaMask/core#readme).
