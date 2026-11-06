import {
  array,
  enums,
  is,
  optional,
  size,
  string,
  type as structType,
} from '@metamask/superstruct';
import { areUint8ArraysEqual } from '@metamask/utils';

import { generateSigningKey, hash, sign } from './crypto.js';
import { MfaRecoveryError } from './errors.js';
import { isFulfilledResult } from './escrow-utils.js';
import {
  SEEDLESS_AUTH_CONNECTION_BY_NAMESPACE,
  SEEDLESS_AUTH_CONNECTIONS,
} from './types.js';
import type {
  Identifier,
  IdentifierAuthMode,
  IdentifierAuthorization,
  KeyBoundCredential,
  KeyBoundIdentifierLogin,
  KeyBoundIdentifierToken,
  RecoveryEscrowProvider,
  RecoveryIdentifierAuthProvider,
  SeedlessAuthConnection,
  SeedlessAuthData,
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

const NonEmptyStringStruct = size(string(), 1, Infinity);

const SeedlessAuthDataStruct = structType({
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

type IdentifierTokenRequest = {
  identifier: Identifier;
  requestHash: string;
  identifierAuthProvider: RecoveryIdentifierAuthProvider;
};

/**
 * Requests a key-bound identifier token for a mutation write. Always uses
 * `getKeyBoundIdentifierToken` and requires the token's identifier to match
 * the requested one exactly.
 *
 * @param params - Identifier authorization parameters.
 * @param params.identifier - Registered identifier authorizing the write.
 * @param params.requestHash - Request hash bound to the authorization.
 * @param params.identifierAuthProvider - Provider for key-bound assertions.
 * @returns Key-bound credential.
 * @throws If the returned token is not bound to this identifier and request.
 */
export async function requestKeyBoundIdentifierToken(
  params: IdentifierTokenRequest,
): Promise<KeyBoundCredential> {
  return await requestBoundToken(params, { allowEmptyValue: false });
}

/**
 * Logs in an identifier for `authenticateIdentifier`. Prefers
 * `getKeyBoundIdentifierLogin` so one social login can also return seedless
 * auth-server tokens; otherwise falls back to `getKeyBoundIdentifierToken`.
 * An empty request `identifier.value` may bind to the subject the provider
 * discovers (see metamask-mobile OIDC identifier provider).
 *
 * @param params - Identifier authorization parameters.
 * @param params.identifier - Identifier to authenticate.
 * @param params.requestHash - Request hash bound to the authorization.
 * @param params.identifierAuthProvider - Provider for key-bound assertions.
 * @param params.requireSeedlessAuthData - When true, fail unless complete
 * seedless auth data (including `revokeToken`) is returned.
 * @returns Key-bound credential and optional seedless auth data.
 * @throws If the returned token is not bound to this identifier and request,
 * or seedless auth data is required but missing / incomplete.
 */
export async function requestIdentifierLogin({
  requireSeedlessAuthData,
  ...params
}: IdentifierTokenRequest & {
  requireSeedlessAuthData: boolean;
}): Promise<KeyBoundCredential & { seedlessAuthData?: SeedlessAuthData }> {
  const { identifier, requestHash, identifierAuthProvider } = params;

  if (identifierAuthProvider.getKeyBoundIdentifierLogin === undefined) {
    if (requireSeedlessAuthData) {
      throwMissingSeedlessAuthData();
    }
    return await requestBoundToken(params, { allowEmptyValue: true });
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
    !isTokenBoundToRequest(token, identifier, proofKey.publicKey, requestHash, {
      allowEmptyValue: true,
    })
  ) {
    throwInvalidIdentifierToken();
  }
  const credential = { token, proofPrivateKey: proofKey.privateKey };

  if (login.seedlessAuthData === undefined) {
    if (requireSeedlessAuthData) {
      throwMissingSeedlessAuthData();
    }
    return credential;
  }
  return {
    ...credential,
    seedlessAuthData: validateSeedlessAuthData(login.seedlessAuthData, {
      identifier,
      requireRevokeToken: requireSeedlessAuthData,
    }),
  };
}

/**
 * Calls `getKeyBoundIdentifierToken` with a fresh proof key and checks the
 * token is bound to the request.
 *
 * @param params - Identifier authorization parameters.
 * @param params.identifier - Identifier to authenticate.
 * @param params.requestHash - Request hash bound to the authorization.
 * @param params.identifierAuthProvider - Provider for key-bound assertions.
 * @param options - Binding options.
 * @param options.allowEmptyValue - Whether an empty request `value` may bind
 * to a provider-discovered subject.
 * @returns Key-bound credential.
 */
async function requestBoundToken(
  { identifier, requestHash, identifierAuthProvider }: IdentifierTokenRequest,
  options: { allowEmptyValue: boolean },
): Promise<KeyBoundCredential> {
  const proofKey = await generateSigningKey();
  const token = await identifierAuthProvider.getKeyBoundIdentifierToken({
    identifier,
    proofPublicKey: proofKey.publicKey,
    requestHash,
  });
  if (
    !isTokenBoundToRequest(
      token,
      identifier,
      proofKey.publicKey,
      requestHash,
      options,
    )
  ) {
    throwInvalidIdentifierToken();
  }
  return { token, proofPrivateKey: proofKey.privateKey };
}

/**
 * @param token - Token returned by the identifier provider.
 * @param identifier - Identifier the provider was asked to authenticate.
 * @param proofPublicKey - Proof public key sent to the provider.
 * @param requestHash - Request hash sent to the provider.
 * @param options - Binding options.
 * @param options.allowEmptyValue - Whether an empty request `value` may bind
 * to a non-empty provider-discovered subject.
 * @returns Whether the token is bound to the identifier, proof key, and request.
 */
function isTokenBoundToRequest(
  token: unknown,
  identifier: Identifier,
  proofPublicKey: Uint8Array,
  requestHash: string,
  { allowEmptyValue }: { allowEmptyValue: boolean },
): token is KeyBoundIdentifierToken {
  if (typeof token !== 'object' || token === null) {
    return false;
  }
  const candidate = token as Partial<KeyBoundIdentifierToken>;
  const tokenIdentifier = candidate.identifier;
  if (
    candidate.requestHash !== requestHash ||
    !(candidate.proofPublicKey instanceof Uint8Array) ||
    !areUint8ArraysEqual(candidate.proofPublicKey, proofPublicKey) ||
    tokenIdentifier === undefined ||
    tokenIdentifier.type !== identifier.type ||
    tokenIdentifier.namespace !== identifier.namespace
  ) {
    return false;
  }
  if (allowEmptyValue && identifier.value === '') {
    return tokenIdentifier.value.length > 0;
  }
  return tokenIdentifier.value === identifier.value;
}

/**
 * Expected seedless `authConnection` for a social identifier, if known.
 *
 * @param identifier - Authenticated identifier.
 * @returns Matching connection, or `undefined` when the identifier is not a
 * known social issuer.
 */
export function expectedSeedlessAuthConnection(
  identifier: Identifier,
): SeedlessAuthConnection | undefined {
  if (identifier.type !== 'social') {
    return undefined;
  }
  return SEEDLESS_AUTH_CONNECTION_BY_NAMESPACE[identifier.namespace];
}

/**
 * Validates seedless auth data shape, strips unknown fields, and checks that
 * `authConnection` matches the expected provider for the authenticated social
 * identifier's issuer namespace. It does not verify that tokens belong to the
 * same subject / `userId` as the identifier value.
 *
 * @param data - Provider-returned seedless auth data.
 * @param options - Validation options.
 * @param options.identifier - Identifier that was authenticated.
 * @param options.requireRevokeToken - Whether `revokeToken` must be present
 * (password unlock path).
 * @returns Documented seedless auth data fields only.
 */
function validateSeedlessAuthData(
  data: unknown,
  {
    identifier,
    requireRevokeToken,
  }: {
    identifier: Identifier;
    requireRevokeToken: boolean;
  },
): SeedlessAuthData {
  if (!is(data, SeedlessAuthDataStruct)) {
    throw new MfaRecoveryError(
      'Incomplete seedless auth data',
      'invalid_seedless_auth_data',
    );
  }
  if (
    requireRevokeToken &&
    (data.revokeToken === undefined || data.revokeToken.length === 0)
  ) {
    throw new MfaRecoveryError(
      'Incomplete seedless auth data',
      'invalid_seedless_auth_data',
    );
  }
  const expectedConnection = expectedSeedlessAuthConnection(identifier);
  if (
    expectedConnection === undefined ||
    data.authConnection !== expectedConnection
  ) {
    throw new MfaRecoveryError(
      'Seedless auth data does not match the authenticated identifier',
      'invalid_seedless_auth_data',
    );
  }
  return pickSeedlessAuthData(data);
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

function throwInvalidIdentifierToken(): never {
  throw new MfaRecoveryError(
    'Identifier token is not bound to this request',
    'invalid_identifier_token',
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
