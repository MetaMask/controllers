import {
  array,
  enums,
  is,
  optional,
  size,
  string,
  type,
} from '@metamask/superstruct';
import { areUint8ArraysEqual } from '@metamask/utils';

import { generateSigningKey, hash, sign } from './crypto.js';
import { MfaRecoveryError } from './errors.js';
import { isFulfilledResult } from './escrow-utils.js';
import {
  SEEDLESS_AUTH_CONNECTIONS,
  type Identifier,
  type IdentifierAuthMode,
  type IdentifierAuthorization,
  type KeyBoundCredential,
  type KeyBoundIdentifierLogin,
  type KeyBoundIdentifierToken,
  type RecoveryEscrowProvider,
  type RecoveryIdentifierAuthProvider,
  type SeedlessAuthData,
} from './types.js';

/**
 * Minimum identifier count for register and updateIdentifiers.
 */
export const MIN_IDENTIFIERS = 2;

/**
 * Distinct identifier identities (`type` + `namespace` + `value`).
 *
 * @param identifiers - Identifier list.
 * @returns Distinct identity count.
 */
export function countDistinctIdentifiers(identifiers: Identifier[]): number {
  return new Set(
    identifiers.map(
      ({ type, namespace, value }) => `${type}\0${namespace}\0${value}`,
    ),
  ).size;
}

/**
 * Trusted identifier-type registry. Escrows and the controller derive the
 * authentication mode from this table, never from a client-selected flag.
 *
 * TODO: MFA-605 / MFA-606 / MFA-568 — add `emailOtp` / `smsOtp` as
 * `escrow-challenge` once escrow OTP commands exist.
 */
export const IDENTIFIER_AUTH_MODES: Record<string, IdentifierAuthMode> = {
  social: 'key-bound',
  passkey: 'key-bound',
  siwe: 'key-bound',
};

export type AuthorizedEscrow = {
  escrow: RecoveryEscrowProvider;
  authorization: IdentifierAuthorization;
};

/**
 * Requests a key-bound identifier token and returns the private key used to
 * prove possession of it.
 *
 * @param params - Identifier authorization parameters.
 * @param params.identifier - Identifier to authenticate.
 * @param params.requestHash - Request hash bound to the authorization.
 * @param params.identifierAuthProvider - Provider for key-bound assertions.
 * @returns Key-bound identifier token and its proof private key.
 */
export async function requestKeyBoundIdentifierToken({
  identifier,
  requestHash,
  identifierAuthProvider,
}: {
  identifier: Identifier;
  requestHash: string;
  identifierAuthProvider: RecoveryIdentifierAuthProvider;
}): Promise<KeyBoundCredential> {
  const proofKey = await generateSigningKey();
  const token = await identifierAuthProvider.getKeyBoundIdentifierToken({
    identifier,
    proofPublicKey: proofKey.publicKey,
    requestHash,
  });
  return { token, proofPrivateKey: proofKey.privateKey };
}

const NonEmptyStringStruct = size(string(), 1, Infinity);

const SeedlessAuthDataStruct = type({
  idTokens: size(array(NonEmptyStringStruct), 1, Infinity),
  accessToken: NonEmptyStringStruct,
  metadataAccessToken: NonEmptyStringStruct,
  refreshToken: NonEmptyStringStruct,
  revokeToken: optional(NonEmptyStringStruct),
  authConnection: enums([...SEEDLESS_AUTH_CONNECTIONS]),
  authConnectionId: NonEmptyStringStruct,
  groupedAuthConnectionId: optional(string()),
  userId: NonEmptyStringStruct,
  socialLoginEmail: optional(string()),
});

/**
 * Performs one identifier login and returns the key-bound credential plus any
 * seedless auth data issued by the same login. Falls back to
 * {@link requestKeyBoundIdentifierToken} when the provider has no
 * `getKeyBoundIdentifierLogin`.
 *
 * @param params - Identifier login parameters.
 * @param params.identifier - Identifier to authenticate.
 * @param params.requestHash - Request hash bound to the token.
 * @param params.identifierAuthProvider - Provider for key-bound assertions.
 * @param params.requireSeedlessAuthData - Whether seedless auth data must be
 * returned.
 * @returns Key-bound credential and optional seedless auth data.
 * @throws If seedless auth data is required but missing or incomplete, or the
 * returned token is not bound to this request.
 */
export async function requestKeyBoundIdentifierLogin({
  identifier,
  requestHash,
  identifierAuthProvider,
  requireSeedlessAuthData,
}: {
  identifier: Identifier;
  requestHash: string;
  identifierAuthProvider: RecoveryIdentifierAuthProvider;
  requireSeedlessAuthData: boolean;
}): Promise<KeyBoundCredential & { seedlessAuthData?: SeedlessAuthData }> {
  if (identifierAuthProvider.getKeyBoundIdentifierLogin === undefined) {
    if (requireSeedlessAuthData) {
      throwMissingSeedlessAuthData();
    }
    return await requestKeyBoundIdentifierToken({
      identifier,
      requestHash,
      identifierAuthProvider,
    });
  }

  const proofKey = await generateSigningKey();
  const login: Partial<KeyBoundIdentifierLogin> | null | undefined =
    await identifierAuthProvider.getKeyBoundIdentifierLogin({
      identifier,
      proofPublicKey: proofKey.publicKey,
      requestHash,
    });
  const token: unknown = login?.token;
  if (
    !login ||
    !isTokenBoundToRequest(token, proofKey.publicKey, requestHash)
  ) {
    throw new MfaRecoveryError(
      'Identifier token is not bound to this request',
      'invalid_identifier_token',
    );
  }
  const credential = { token, proofPrivateKey: proofKey.privateKey };

  if (login.seedlessAuthData === undefined) {
    if (requireSeedlessAuthData) {
      throwMissingSeedlessAuthData();
    }
    return credential;
  }
  if (!is(login.seedlessAuthData, SeedlessAuthDataStruct)) {
    throw new MfaRecoveryError(
      'Incomplete seedless auth data',
      'invalid_seedless_auth_data',
    );
  }
  return {
    ...credential,
    seedlessAuthData: pickSeedlessAuthData(login.seedlessAuthData),
  };
}

/**
 * @param token - Token returned by the identifier provider.
 * @param proofPublicKey - Proof public key sent to the provider.
 * @param requestHash - Request hash sent to the provider.
 * @returns Whether the token is bound to the proof key and request.
 */
function isTokenBoundToRequest(
  token: unknown,
  proofPublicKey: Uint8Array,
  requestHash: string,
): token is KeyBoundIdentifierToken {
  if (typeof token !== 'object' || token === null) {
    return false;
  }
  const candidate = token as Partial<KeyBoundIdentifierToken>;
  return (
    candidate.requestHash === requestHash &&
    candidate.proofPublicKey instanceof Uint8Array &&
    areUint8ArraysEqual(candidate.proofPublicKey, proofPublicKey)
  );
}

/**
 * Copies only the documented fields, so extra provider fields (for example
 * `skipLock`) cannot reach `SeedlessOnboardingController.authenticate`.
 *
 * @param data - Validated seedless auth data.
 * @returns Seedless auth data with only documented fields.
 */
function pickSeedlessAuthData(data: SeedlessAuthData): SeedlessAuthData {
  const {
    idTokens,
    accessToken,
    metadataAccessToken,
    refreshToken,
    revokeToken,
    authConnection,
    authConnectionId,
    groupedAuthConnectionId,
    userId,
    socialLoginEmail,
  } = data;
  return {
    idTokens: [...idTokens],
    accessToken,
    metadataAccessToken,
    refreshToken,
    authConnection,
    authConnectionId,
    userId,
    ...(revokeToken === undefined ? {} : { revokeToken }),
    ...(groupedAuthConnectionId === undefined
      ? {}
      : { groupedAuthConnectionId }),
    ...(socialLoginEmail === undefined ? {} : { socialLoginEmail }),
  };
}

function throwMissingSeedlessAuthData(): never {
  throw new MfaRecoveryError(
    'Identifier login did not return seedless auth data',
    'missing_seedless_auth_data',
  );
}

/**
 * Presents a key-bound credential to each escrow that provides a challenge.
 *
 * @param params - Escrow authorization parameters.
 * @param params.escrows - Escrows to authorize.
 * @param params.credential - Key-bound identifier credential.
 * @returns Successful escrow authorizations.
 */
export async function authorizeEscrowsWithToken({
  escrows,
  credential,
}: {
  escrows: RecoveryEscrowProvider[];
  credential: KeyBoundCredential;
}): Promise<AuthorizedEscrow[]> {
  const { token, proofPrivateKey } = credential;
  const challengeResults = await Promise.allSettled(
    escrows.map((escrow) => escrow.generateChallenge()),
  );
  const challenges = challengeResults.flatMap((result, index) =>
    isFulfilledResult(result)
      ? [{ escrow: escrows[index], challenge: result.value }]
      : [],
  );
  const authorizationResults = await Promise.allSettled(
    challenges.map(async ({ escrow, challenge }) => {
      const message = await hash([token, challenge.id, token.requestHash]);
      return {
        escrow,
        authorization: {
          kind: 'key-bound' as const,
          token,
          proof: {
            challengeId: challenge.id,
            requestHash: token.requestHash,
            signature: await sign(proofPrivateKey, message),
          },
        },
      };
    }),
  );
  return authorizationResults
    .filter(isFulfilledResult)
    .map((result) => result.value);
}

/**
 * Returns the auth mode for an identifier type.
 *
 * @param type - Identifier type.
 * @returns Auth mode.
 * @throws If the type is not in the trusted registry.
 */
export function getIdentifierAuthMode(type: string): IdentifierAuthMode {
  const mode = IDENTIFIER_AUTH_MODES[type];
  if (mode === undefined) {
    throw new MfaRecoveryError(
      `Unknown identifier type: ${type}`,
      'unknown_identifier_type',
    );
  }
  return mode;
}
