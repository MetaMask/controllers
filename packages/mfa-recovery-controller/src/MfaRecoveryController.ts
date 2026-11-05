import type {
  ControllerGetStateAction,
  ControllerStateChangedEvent,
  StateMetadata,
} from '@metamask/base-controller';
import { BaseController } from '@metamask/base-controller';
import type { Messenger } from '@metamask/messenger';
import { bytesToHex, hexToBytes } from '@metamask/utils';

import { decodeAuthControllerToken } from './auth-controller-token.js';
import {
  decryptFromPublic,
  encryptToPublic,
  generateWrapKey,
  hash,
  randomId,
  unixNow,
  wrapKeyId,
} from './crypto.js';
import {
  IncompleteMutationError,
  MfaRecoveryError,
  MutationRejectedError,
} from './errors.js';
import {
  isFulfilledResult,
  isMutationReceipt,
  selectHighestConsistentVersion,
  verifyMutationReceipt,
} from './escrow-utils.js';
import {
  authorizeEscrowsWithToken,
  countDistinctIdentifiers,
  getIdentifierAuthMode,
  getSiweNamespace,
  MIN_IDENTIFIERS,
  requestKeyBoundIdentifierToken,
} from './identifier-auth.js';
import type { MfaRecoveryControllerMethodActions } from './MfaRecoveryController-method-action-types.js';
import {
  assertValidPendingOperation,
  pendingPayloadHasIdentifiers,
  pendingPayloadHasRecoverySecret,
} from './pending-operation-validation.js';
import { assertAbortAllowed, getRecoveryPhase } from './state-machine.js';
import type {
  GetIdentifiersResponse,
  Identifier,
  IdentifierAuthorization,
  IdentifierSession,
  KeyBoundCredential,
  Mutation,
  MutationPayload,
  MutationReceipt,
  PendingOperation,
  PendingOperationEncryptor,
  PendingRegisterPayload,
  PendingUpdateIdentifiersPayload,
  PendingUpdateRecoverySecretPayload,
  RecoveryAuthProvider,
  RecoveryEscrowProvider,
  RecoveryIdentifierAuthProvider,
  RecoveryIdentifiers,
  RecoveryLockProvider,
  RecoveryPhase,
  RecoveredSecret,
  WrappedSecret,
  WritingPendingOperation,
} from './types.js';

const CONTROLLER_NAME = 'MfaRecoveryController';

const MESSENGER_EXPOSED_METHODS = [
  'acquireLock',
  'renewLock',
  'releaseLock',
  'register',
  'updateRecoverySecret',
  'updateIdentifiers',
  'authenticateIdentifier',
  'getRecoverySecret',
  'getIdentifiers',
  'resume',
  'abort',
  'getPhase',
] as const;

export type MfaRecoveryControllerState = {
  /**
   * Held recovery lease ID, reused when retrying, or `null`.
   */
  lockId: string | null;
  /**
   * Encrypted pending mutation, or `null` when idle.
   */
  pendingOperation: string | null;
};

const mfaRecoveryControllerMetadata = {
  lockId: {
    persist: true,
    includeInDebugSnapshot: false,
    includeInStateLogs: false,
    usedInUi: false,
  },
  pendingOperation: {
    persist: true,
    includeInDebugSnapshot: false,
    includeInStateLogs: false,
    usedInUi: true,
  },
} satisfies StateMetadata<MfaRecoveryControllerState>;

/**
 * @returns The default {@link MfaRecoveryController} state.
 */
export function getDefaultMfaRecoveryControllerState(): MfaRecoveryControllerState {
  return { lockId: null, pendingOperation: null };
}

export type MfaRecoveryControllerGetStateAction = ControllerGetStateAction<
  typeof CONTROLLER_NAME,
  MfaRecoveryControllerState
>;

export type MfaRecoveryControllerActions =
  | MfaRecoveryControllerGetStateAction
  | MfaRecoveryControllerMethodActions;

type AllowedActions = never;

export type MfaRecoveryControllerStateChangedEvent =
  ControllerStateChangedEvent<
    typeof CONTROLLER_NAME,
    MfaRecoveryControllerState
  >;

export type MfaRecoveryControllerEvents =
  MfaRecoveryControllerStateChangedEvent;

type AllowedEvents = never;

export type MfaRecoveryControllerMessenger = Messenger<
  typeof CONTROLLER_NAME,
  MfaRecoveryControllerActions | AllowedActions,
  MfaRecoveryControllerEvents | AllowedEvents
>;

export type MfaRecoveryControllerOptions = {
  /**
   * The messenger suited for this controller.
   */
  messenger: MfaRecoveryControllerMessenger;

  /**
   * The desired state with which to initialize this controller. Missing
   * properties will be filled in with defaults.
   */
  state?: Partial<MfaRecoveryControllerState>;

  /**
   * Authenticates the MetaMask profile and issues request-bound attestations.
   */
  authProvider: RecoveryAuthProvider;

  /**
   * Holds the per-profile recovery lease.
   */
  lockProvider: RecoveryLockProvider;

  /**
   * Obtains key-bound identifier tokens from an IdP.
   */
  identifierAuthProvider: RecoveryIdentifierAuthProvider;

  /**
   * Ordered, non-empty set of recovery escrow replicas. This is build-time
   * configuration; public methods cannot override it.
   */
  escrows: RecoveryEscrowProvider[];

  /**
   * Encrypts pending mutation state using wallet secure storage.
   */
  pendingOperationEncryptor: PendingOperationEncryptor;

  /**
   * Clock used for AuthController token expiry checks. Unix seconds.
   * Defaults to {@link unixNow}.
   */
  now?: () => number;
};

type MutateParams = {
  epoch: number;
} & (
  | {
      operation: 'register';
      payload: PendingRegisterPayload;
      identifier: null;
    }
  | {
      operation: 'updateRecoverySecret';
      payload: PendingUpdateRecoverySecretPayload;
      identifier: Identifier;
    }
  | {
      operation: 'updateIdentifiers';
      payload: PendingUpdateIdentifiersPayload;
      identifier: Identifier;
    }
);

/**
 * Coordinates MFA recovery secret replication across independent escrows.
 */
export class MfaRecoveryController extends BaseController<
  typeof CONTROLLER_NAME,
  MfaRecoveryControllerState,
  MfaRecoveryControllerMessenger
> {
  readonly #authProvider: RecoveryAuthProvider;

  readonly #lockProvider: RecoveryLockProvider;

  readonly #identifierAuthProvider: RecoveryIdentifierAuthProvider;

  readonly #escrows: RecoveryEscrowProvider[];

  readonly #encryptor: PendingOperationEncryptor;

  readonly #now: () => number;

  #lock: Promise<void> = Promise.resolve();

  constructor({
    messenger,
    state,
    authProvider,
    lockProvider,
    identifierAuthProvider,
    escrows,
    pendingOperationEncryptor,
    now = unixNow,
  }: MfaRecoveryControllerOptions) {
    if (escrows.length === 0) {
      throw new MfaRecoveryError(
        'At least one escrow is required',
        'empty_escrow_set',
      );
    }
    const escrowIds = escrows.map((escrow) => escrow.id);
    if (new Set(escrowIds).size !== escrowIds.length) {
      throw new MfaRecoveryError('Duplicate escrow id', 'duplicate_escrow_id');
    }

    super({
      messenger,
      metadata: mfaRecoveryControllerMetadata,
      name: CONTROLLER_NAME,
      state: {
        ...getDefaultMfaRecoveryControllerState(),
        ...state,
      },
    });

    this.#authProvider = authProvider;
    this.#lockProvider = lockProvider;
    this.#identifierAuthProvider = identifierAuthProvider;
    this.#escrows = [...escrows];
    this.#encryptor = pendingOperationEncryptor;
    this.#now = now;

    this.messenger.registerMethodActionHandlers(
      this,
      MESSENGER_EXPOSED_METHODS,
    );
  }

  /**
   * Acquires the per-profile recovery lease. Hold it from the first read
   * through any Auth identifier changes and mutations.
   */
  async acquireLock(): Promise<void> {
    await this.#withLock(async () => this.#acquireLease());
  }

  /**
   * Renews the held lease. Fails if it expired or another operation holds it;
   * then acquire again and reread state.
   */
  async renewLock(): Promise<void> {
    await this.#withLock(async () => {
      const { lockId } = this.state;
      if (lockId === null) {
        throw new MfaRecoveryError(
          'Acquire the recovery lock first',
          'recovery_lock_required',
        );
      }
      await this.#lockProvider.renew(lockId);
    });
  }

  /**
   * Releases the lease. A pending mutation must finish first.
   */
  async releaseLock(): Promise<void> {
    await this.#withLock(async () => {
      if (await this.#loadPending()) {
        throw new MfaRecoveryError(
          'A pending mutation must be resumed or aborted first',
          'pending_mutation',
        );
      }
      const { lockId } = this.state;
      if (lockId === null) {
        return;
      }
      await this.#lockProvider.release(lockId);
      this.update((state) => {
        state.lockId = null;
      });
    });
  }

  /**
   * Creates version 1 of a recovery record.
   *
   * @param recoverySecret - Secret replicated in full to every escrow.
   * @param identifiers - Ownership-approved identifier set. Must contain at
   * least two identifiers.
   */
  async register(
    recoverySecret: Uint8Array,
    identifiers: Identifier[],
  ): Promise<void> {
    this.#assertValidIdentifiers(identifiers);
    this.#assertMinIdentifiers(identifiers);
    await this.#mutate({
      operation: 'register',
      payload: {
        identifiers,
        recoverySecret: bytesToHex(recoverySecret),
      },
      identifier: null,
      epoch: 0,
    });
  }

  /**
   * Replaces the recovery secret.
   *
   * @param identifier - Currently registered identifier used to authorize.
   * @param recoverySecret - New secret.
   * @param epoch - Current recovery version, used as `expectedVersion`.
   */
  async updateRecoverySecret(
    identifier: Identifier,
    recoverySecret: Uint8Array,
    epoch: number,
  ): Promise<void> {
    this.#assertValidIdentifiers([identifier]);
    await this.#mutate({
      operation: 'updateRecoverySecret',
      payload: {
        recoverySecret: bytesToHex(recoverySecret),
      },
      identifier,
      epoch,
    });
  }

  /**
   * Replaces the complete identifier set.
   *
   * @param identifier - Currently registered identifier used to authorize.
   * @param identifiers - New identifier set. Must contain at least two
   * identifiers.
   * @param epoch - Current recovery version, used as `expectedVersion`.
   */
  async updateIdentifiers(
    identifier: Identifier,
    identifiers: Identifier[],
    epoch: number,
  ): Promise<void> {
    this.#assertValidIdentifiers([identifier, ...identifiers]);
    this.#assertMinIdentifiers(identifiers);
    await this.#mutate({
      operation: 'updateIdentifiers',
      payload: { identifiers },
      identifier,
      epoch,
    });
  }

  /**
   * Authenticates an identifier for a subsequent recovery-secret read.
   *
   * @param identifier - Identifier to authenticate.
   * @returns Ephemeral session data required by {@link getRecoverySecret}.
   */
  async authenticateIdentifier(
    identifier: Identifier,
  ): Promise<IdentifierSession> {
    this.#assertValidIdentifiers([identifier]);
    const requestId = randomId();
    const ephemeral = await generateWrapKey();
    const pkE = ephemeral.publicKey;
    const requestHash = await hash({
      operation: 'getRecoverySecret',
      requestId,
      pkE,
    });
    const credential = await requestKeyBoundIdentifierToken({
      identifier,
      requestHash,
      identifierAuthProvider: this.#identifierAuthProvider,
    });
    return {
      ...credential,
      requestId,
      ephemeralPrivateKey: ephemeral.privateKey,
      pkE,
    };
  }

  /**
   * Reads the recovery secret from available escrows and returns the highest
   * consistent version. `epoch` is the current recovery version and is required
   * by later mutations. Does not wait for a pending mutation to be repaired.
   *
   * @param session - Identifier authentication session used to authorize the
   * read.
   * @returns Recovered secret bytes and the selected epoch.
   */
  async getRecoverySecret(
    session: IdentifierSession,
  ): Promise<RecoveredSecret> {
    return await this.#withLock(async () => {
      const { token, requestId, pkE } = session;
      this.#assertValidIdentifiers([token.identifier]);
      const requestHash = await hash({
        operation: 'getRecoverySecret',
        requestId,
        pkE,
      });
      if (token.requestHash !== requestHash) {
        throw new MfaRecoveryError(
          'Invalid identifier session',
          'invalid_identifier_session',
        );
      }
      const available = await this.#getAvailableEscrows();
      if (available.length === 0) {
        throw new MfaRecoveryError(
          'No escrow is available',
          'no_available_escrow',
        );
      }
      const { approval } = await this.#authProvider.authorizeRecoveryRequest({
        requestHash,
        audiences: available.map((escrow) => escrow.authAudience),
        requireTwoFactor: true,
      });
      const authorizedEscrows = await authorizeEscrowsWithToken({
        escrows: available,
        credentials: [session],
        authControllerToken: approval,
      });
      const results = await Promise.allSettled(
        authorizedEscrows.map(async ({ escrow, authorizations }) => {
          const [authorization] = authorizations;
          const response = await escrow.getSecret(
            approval,
            authorization,
            requestId,
            pkE,
          );
          if (response.wrapKeyId !== (await wrapKeyId(escrow.wrapPublicKey))) {
            throw new MfaRecoveryError(
              'Unexpected wrap key',
              'wrap_key_mismatch',
            );
          }
          return {
            escrowId: escrow.id,
            recoverySecret: await decryptFromPublic(
              session.ephemeralPrivateKey,
              escrow.wrapPublicKey,
              response.recoverySecret.ciphertext,
            ),
            version: response.version,
          };
        }),
      );
      const selected = selectHighestConsistentVersion(results);
      return {
        recoverySecret: selected.recoverySecret,
        epoch: selected.version,
      };
    });
  }

  /**
   * Reads the enrolled identifiers from every escrow, with Auth's current
   * identifiers. Needs no recent MFA, so a new device can build an
   * {@link updateIdentifiers} call from it. Throws `replica_lagging` when
   * escrows are at different versions.
   *
   * @returns Enrolled identifiers, `epoch`, and Auth's identifiers.
   */
  async getIdentifiers(): Promise<RecoveryIdentifiers> {
    return await this.#withLock(async () => {
      await this.#assertEscrowsAvailable(this.#escrows);
      const { approval, identifiers: authIdentifiers } =
        await this.#authProvider.authorizeRecoveryRequest({
          requestHash: await hash({ operation: 'getIdentifiers' }),
          audiences: this.#escrows.map((escrow) => escrow.authAudience),
        });
      const responses = await Promise.all(
        this.#escrows.map(
          async (escrow) => await escrow.getIdentifiers(approval),
        ),
      );
      assertSameVersion(responses);
      const hashes = await Promise.all(
        responses.map(async ({ identifiers }) => await hash(identifiers)),
      );
      if (new Set(hashes).size !== 1) {
        throw new MfaRecoveryError('Replica corruption', 'replica_corruption');
      }
      const [{ identifiers, version: epoch }] = responses;
      return { identifiers, epoch, authIdentifiers };
    });
  }

  /**
   * Completes a persisted pending mutation. With none pending and an
   * `identifier`, copies the highest escrow record to escrows one version
   * behind it; pass an identifier when a mutation fails with
   * `replica_lagging`.
   *
   * @param identifier - Enrolled identifier that authorizes the repair, or
   * replaces the one authorizing a pending update (e.g. if it was lost).
   */
  async resume(identifier?: Identifier): Promise<void> {
    const hadPending = await this.#withLock(async () => {
      const pending = await this.#loadPending();
      if (pending) {
        await this.#finishPendingMutation(
          identifier && pending.identifier
            ? { ...pending, identifier }
            : pending,
        );
      }
      return pending !== null;
    });
    if (!hadPending && identifier) {
      await this.#repairReplicas(identifier);
    }
  }

  /**
   * Drops `authorizing` pending. `writing` must be finished with {@link resume}.
   */
  async abort(): Promise<void> {
    await this.#withLock(async () => {
      const pending = await this.#loadPending();
      assertAbortAllowed(pending);
      if (pending) {
        await this.#clearPending();
      }
    });
  }

  /**
   * @returns Current recovery phase.
   */
  async getPhase(): Promise<RecoveryPhase> {
    return await this.#withLock(async () =>
      getRecoveryPhase(await this.#loadPending()),
    );
  }

  async #mutate(params: MutateParams, escrows = this.#escrows): Promise<void> {
    const { operation, payload, identifier, epoch } = params;
    await this.#withLock(async () => {
      if (await this.#loadPending()) {
        throw new MfaRecoveryError(
          'A pending mutation must be resumed or aborted first',
          'pending_mutation',
        );
      }

      await this.#assertEscrowsAvailable(escrows);
      const replicas = await this.#readReplicas(escrows);
      assertSameVersion(replicas);
      if (identifier && !isEnrolledInEvery(replicas, identifier)) {
        throw new MfaRecoveryError(
          'Identifier is not enrolled on every escrow',
          'identifier_not_enrolled',
        );
      }

      const profileId = await this.#authProvider.getAuthenticatedProfileId();
      const audiences = escrows.map((escrow) => escrow.id);
      const currentVersion = this.#resolveCurrentRecoveryVersion(epoch);
      const payloadHash = await hash(payload);

      const mutationFields = {
        id: randomId(),
        profileId,
        operation,
        expectedVersion: currentVersion,
        newVersion: currentVersion + 1,
        payloadHash,
        audiences,
      };
      const mutation: Mutation = {
        ...mutationFields,
        requestHash: await hash(mutationFields),
      };

      const pending: PendingOperation = {
        phase: 'authorizing',
        mutation,
        payload,
        identifier,
      };
      await this.#persistPending(pending);

      await this.#replicateMutation({
        ...pending,
        phase: 'writing',
        ...(await this.#authorizeMutation(mutation)),
        receipts: [],
      });
    });
  }

  async #authorizeMutation(
    mutation: Mutation,
  ): Promise<
    Pick<WritingPendingOperation, 'authControllerToken' | 'approvedIdentifiers'>
  > {
    // The lease outlives the approval, so no write lands after another
    // operation can take the lease.
    const { lockId } = this.state;
    if (lockId === null) {
      await this.#acquireLease();
    } else {
      await this.#lockProvider.renew(lockId);
    }
    const { approval, identifiers } =
      await this.#authProvider.authorizeRecoveryRequest({
        requestHash: mutation.requestHash,
        audiences: this.#getTargetEscrows(mutation).map(
          (escrow) => escrow.authAudience,
        ),
        requireTwoFactor: true,
      });
    return { authControllerToken: approval, approvedIdentifiers: identifiers };
  }

  async #finishPendingMutation(pending: PendingOperation): Promise<void> {
    if (pending.phase === 'authorizing') {
      await this.#assertEscrowsAvailable(
        this.#getTargetEscrows(pending.mutation),
      );
      await this.#replicateMutation({
        ...pending,
        phase: 'writing',
        ...(await this.#authorizeMutation(pending.mutation)),
        receipts: [],
      });
      return;
    }

    // writing phase
    await this.#replicateMutation(pending);
  }

  async #replicateMutation(pending: WritingPendingOperation): Promise<void> {
    const { mutation } = pending;
    const remainingEscrows = await this.#getRemainingEscrows(pending);
    if (remainingEscrows.length === 0) {
      await this.#clearPending();
      return;
    }

    await this.#assertEscrowsAvailable(remainingEscrows);

    const claims = decodeAuthControllerToken(pending.authControllerToken);
    const writing =
      claims && claims.exp > this.#now()
        ? pending
        : { ...pending, ...(await this.#authorizeMutation(mutation)) };
    const { escrows, probe, replicas } = await this.#getEscrowsToWrite(
      writing,
      remainingEscrows,
    );
    try {
      await this.#assertPending(writing);
    } catch (error) {
      // A renewed approval drops identifiers removed from Auth since, and
      // escrows fail a payload it does not cover. Once every remaining escrow
      // moved, the mutation can no longer land anywhere. The versions were
      // read with this approval, so they only count for the mutation's profile.
      if (
        probe &&
        escrows.length === remainingEscrows.length &&
        decodeAuthControllerToken(writing.authControllerToken)?.sub ===
          mutation.profileId
      ) {
        await this.#clearPending();
        throw new MfaRecoveryError(
          'Mutation was superseded; reread state',
          'mutation_superseded',
        );
      }
      throw error;
    }
    // Probes need no proofs; see `RecoveryEscrowProvider.applyMutation`.
    const authorizations = probe
      ? escrows.map(() => [])
      : await this.#authorizeEscrows(writing, escrows, replicas);
    const payloads = await Promise.all(
      escrows.map(async (escrow) => this.#payloadForEscrow(writing, escrow)),
    );

    await this.#persistPending(writing);
    const results = await Promise.allSettled(
      escrows.map((escrow, index) =>
        escrow.applyMutation(
          mutation,
          writing.authControllerToken,
          authorizations[index],
          payloads[index],
          writing.approvedIdentifiers,
        ),
      ),
    );

    const { receipts, hasInvalidReceipt } = await this.#collectMutationReceipts(
      results,
      escrows,
      mutation,
      writing.receipts,
    );
    const rejection = unanimousMutationRejection(results);
    if (rejection) {
      await this.#clearPending();
      if (writing.receipts.length > 0) {
        throw new MfaRecoveryError(
          'Mutation was applied on some escrows; reread state',
          'mutation_superseded',
        );
      }
      throw rejection;
    }
    await this.#persistPending({ ...writing, receipts });

    if (hasInvalidReceipt) {
      throw new MfaRecoveryError('Invalid mutation receipt', 'invalid_receipt');
    }

    if (
      new Set(receipts.map((receipt) => receipt.escrowId)).size !==
      mutation.audiences.length
    ) {
      throw new IncompleteMutationError(mutation.id);
    }
    await this.#clearPending();
  }

  // Runs outside the controller lock: `#mutate` and `getRecoverySecret` take it.
  async #repairReplicas(identifier: Identifier): Promise<void> {
    this.#assertValidIdentifiers([identifier]);
    await this.#assertEscrowsAvailable(this.#escrows);
    const replicas = await this.#readReplicas(this.#escrows);
    const epoch = Math.max(...replicas.map(({ version }) => version));
    if (replicas.some(({ version }) => version < epoch - 1)) {
      throw new MfaRecoveryError(
        'Escrows are more than one version apart',
        'replica_corruption',
      );
    }
    const laggingEscrows = this.#escrows.filter(
      (_, index) => replicas[index].version < epoch,
    );
    if (laggingEscrows.length === 0) {
      return;
    }
    await this.#mutate(
      await this.#getRepairParams(identifier, replicas, epoch),
      laggingEscrows,
    );
  }

  // Lagging escrows are at `epoch - 1`: replay the write they missed.
  async #getRepairParams(
    identifier: Identifier,
    replicas: GetIdentifiersResponse[],
    epoch: number,
  ): Promise<MutateParams> {
    const [leader] = replicas.filter(({ version }) => version === epoch);
    const identifierHashes = await Promise.all(
      replicas.map(async ({ identifiers }) => await hash(identifiers)),
    );
    const leaderHashes = identifierHashes.filter(
      (_, index) => replicas[index].version === epoch,
    );
    if (new Set(leaderHashes).size > 1) {
      throw new MfaRecoveryError('Replica corruption', 'replica_corruption');
    }
    if (epoch > 1 && new Set(identifierHashes).size > 1) {
      return {
        operation: 'updateIdentifiers',
        payload: { identifiers: leader.identifiers },
        identifier,
        epoch: epoch - 1,
      };
    }

    const secret = await this.getRecoverySecret(
      await this.authenticateIdentifier(identifier),
    );
    if (secret.epoch !== epoch) {
      throw new MfaRecoveryError(
        'Could not read the highest escrow record',
        'read_failed',
      );
    }
    const recoverySecret = bytesToHex(secret.recoverySecret);
    if (epoch === 1) {
      return {
        operation: 'register',
        payload: { identifiers: leader.identifiers, recoverySecret },
        identifier: null,
        epoch: 0,
      };
    }
    return {
      operation: 'updateRecoverySecret',
      payload: { recoverySecret },
      identifier,
      epoch: epoch - 1,
    };
  }

  // Every escrow must answer; a missing record reads as version 0.
  async #readReplicas(
    escrows: RecoveryEscrowProvider[],
  ): Promise<GetIdentifiersResponse[]> {
    const { approval } = await this.#authProvider.authorizeRecoveryRequest({
      requestHash: await hash({ operation: 'getIdentifiers' }),
      audiences: escrows.map((escrow) => escrow.authAudience),
    });
    return await Promise.all(
      escrows.map(async (escrow) => await escrow.getIdentifiers(approval)),
    );
  }

  // Escrows off `expectedVersion` are probed alone: a version read cannot tell
  // whether this mutation moved them, but they replay its receipt or reject,
  // never forking the rest. Escrows fail, rather than reject, an unenrolled
  // identifier. `replicas` are the reads of `remainingEscrows`.
  async #getEscrowsToWrite(
    writing: WritingPendingOperation,
    remainingEscrows: RecoveryEscrowProvider[],
  ): Promise<{
    escrows: RecoveryEscrowProvider[];
    probe: boolean;
    replicas: GetIdentifiersResponse[];
  }> {
    const { mutation, identifier } = writing;
    const replicas = await Promise.all(
      remainingEscrows.map(
        async (escrow) =>
          await escrow.getIdentifiers(writing.authControllerToken),
      ),
    );
    const moved = remainingEscrows.filter(
      (_, index) => replicas[index].version !== mutation.expectedVersion,
    );
    if (moved.length > 0) {
      return { escrows: moved, probe: true, replicas };
    }
    if (identifier && !isEnrolledInEvery(replicas, identifier)) {
      throw new MfaRecoveryError(
        'Identifier is not enrolled on every escrow',
        'identifier_not_enrolled',
      );
    }
    return { escrows: remainingEscrows, probe: false, replicas };
  }

  #getTargetEscrows(mutation: Mutation): RecoveryEscrowProvider[] {
    return this.#escrows.filter(({ id }) => mutation.audiences.includes(id));
  }

  async #assertEscrowsAvailable(
    escrows: RecoveryEscrowProvider[],
  ): Promise<void> {
    const availableEscrows = await this.#getAvailableEscrows(escrows);
    // Do we want to wait for all escrows to be available?
    if (availableEscrows.length !== escrows.length) {
      throw new MfaRecoveryError(
        'All configured escrows are required for mutation',
        'escrow_unavailable',
      );
    }
  }

  async #getRemainingEscrows(
    pending: WritingPendingOperation,
  ): Promise<RecoveryEscrowProvider[]> {
    const { mutation } = pending;
    const remainingEscrows: RecoveryEscrowProvider[] = [];
    for (const escrow of this.#getTargetEscrows(mutation)) {
      const receipt = pending.receipts.find(
        (item) => item.escrowId === escrow.id,
      );
      if (receipt === undefined) {
        remainingEscrows.push(escrow);
        continue;
      }
      if (!(await verifyMutationReceipt(receipt, mutation, escrow))) {
        throw new MfaRecoveryError(
          'Invalid mutation receipt',
          'invalid_receipt',
        );
      }
    }
    if (
      remainingEscrows.length + pending.receipts.length !==
      mutation.audiences.length
    ) {
      throw new MfaRecoveryError(
        'Receipt escrow is not configured',
        'unknown_receipt_escrow',
      );
    }
    return remainingEscrows;
  }

  async #collectMutationReceipts(
    results: PromiseSettledResult<MutationReceipt>[],
    escrows: RecoveryEscrowProvider[],
    mutation: Mutation,
    existingReceipts: MutationReceipt[],
  ): Promise<{ receipts: MutationReceipt[]; hasInvalidReceipt: boolean }> {
    const receipts = [...existingReceipts];
    let hasInvalidReceipt = false;
    for (const [index, result] of results.entries()) {
      if (!isFulfilledResult(result)) {
        continue;
      }
      const escrow = escrows[index];
      if (
        !isMutationReceipt(result.value) ||
        !(await verifyMutationReceipt(result.value, mutation, escrow))
      ) {
        hasInvalidReceipt = true;
        continue;
      }
      receipts.push(result.value);
    }
    return { receipts, hasInvalidReceipt };
  }

  /**
   * Proves the update's enrolled identifier and each SIWE identifier the
   * escrows have not enrolled, all against one challenge per escrow.
   *
   * @param writing - Writing pending mutation.
   * @param escrows - Escrows to authorize.
   * @param replicas - Their reads, in `escrows` order.
   * @returns Each escrow's identifier authorizations, in `escrows` order.
   */
  async #authorizeEscrows(
    writing: WritingPendingOperation,
    escrows: RecoveryEscrowProvider[],
    replicas: GetIdentifiersResponse[],
  ): Promise<IdentifierAuthorization[][]> {
    const identifiers = [
      ...(writing.identifier ? [writing.identifier] : []),
      ...findNewSiweIdentifiers(writing, replicas),
    ];
    if (identifiers.length === 0) {
      return escrows.map(() => []);
    }
    const credentials: KeyBoundCredential[] = [];
    for (const identifier of identifiers) {
      getIdentifierAuthMode(identifier.type);
      credentials.push(
        await requestKeyBoundIdentifierToken({
          identifier,
          requestHash: writing.mutation.requestHash,
          identifierAuthProvider: this.#identifierAuthProvider,
        }),
      );
    }
    const authorized = await authorizeEscrowsWithToken({
      escrows,
      credentials,
      authControllerToken: writing.authControllerToken,
    });
    if (authorized.length !== escrows.length) {
      throw new MfaRecoveryError(
        'Unable to authorize every escrow',
        'identifier_auth_failed',
      );
    }
    return authorized.map(({ authorizations }) => authorizations);
  }

  async #payloadForEscrow(
    pending: WritingPendingOperation,
    escrow: RecoveryEscrowProvider,
  ): Promise<MutationPayload> {
    const { payload } = pending;
    if (!pendingPayloadHasRecoverySecret(payload)) {
      return {
        identifiers: payload.identifiers,
      };
    }
    const recoverySecret = await this.#wrapRecoverySecret(
      hexToBytes(payload.recoverySecret),
      escrow.wrapPublicKey,
    );
    if (pendingPayloadHasIdentifiers(payload)) {
      return {
        identifiers: payload.identifiers,
        recoverySecret,
      };
    }
    return { recoverySecret };
  }

  #resolveCurrentRecoveryVersion(epoch: number): number {
    if (!Number.isInteger(epoch) || epoch < 0) {
      throw new MfaRecoveryError('Invalid epoch', 'invalid_epoch');
    }
    return epoch;
  }

  async #getAvailableEscrows(
    escrows: RecoveryEscrowProvider[] = this.#escrows,
  ): Promise<RecoveryEscrowProvider[]> {
    const flags = await Promise.allSettled(
      escrows.map(async (escrow) => ({
        escrow,
        available: await escrow.isAvailable(),
      })),
    );
    return flags.flatMap((result) =>
      isFulfilledResult(result) && result.value.available
        ? [result.value.escrow]
        : [],
    );
  }

  #assertValidIdentifiers(identifiers: Identifier[]): void {
    for (const identifier of identifiers) {
      getIdentifierAuthMode(identifier.type);
      if (
        identifier.type === 'siwe' &&
        identifier.namespace !== getSiweNamespace(identifier)
      ) {
        throw new MfaRecoveryError(
          'SIWE namespace must be the verifier domain:chainId',
          'invalid_identifier',
        );
      }
    }
  }

  #assertMinIdentifiers(identifiers: Identifier[]): void {
    if (countDistinctIdentifiers(identifiers) < MIN_IDENTIFIERS) {
      throw new MfaRecoveryError(
        `Requires at least ${MIN_IDENTIFIERS} identifiers`,
        'too_few_identifiers',
      );
    }
  }

  async #wrapRecoverySecret(
    plaintext: Uint8Array,
    wrapPublicKey: Uint8Array,
  ): Promise<WrappedSecret> {
    const ephemeral = await generateWrapKey();
    return {
      pkE: ephemeral.publicKey,
      ciphertext: await encryptToPublic(
        ephemeral.privateKey,
        wrapPublicKey,
        plaintext,
      ),
    };
  }

  async #loadPending(): Promise<PendingOperation | null> {
    const { pendingOperation } = this.state;
    if (pendingOperation === null) {
      return null;
    }
    const pending = (await this.#encryptor.decrypt(
      pendingOperation,
    )) as unknown;
    await this.#assertPending(pending);
    return pending as PendingOperation;
  }

  async #persistPending(operation: PendingOperation): Promise<void> {
    await this.#assertPending(operation);
    const encrypted = await this.#encryptor.encrypt(operation);
    this.update((state) => {
      state.pendingOperation = encrypted;
    });
  }

  async #assertPending(pending: unknown): Promise<void> {
    await assertValidPendingOperation(
      pending,
      this.#escrows.map((escrow) => escrow.id),
    );
  }

  async #clearPending(): Promise<void> {
    this.update((state) => {
      state.pendingOperation = null;
    });
  }

  async #acquireLease(): Promise<void> {
    const lockId = this.state.lockId ?? randomId();
    this.update((state) => {
      state.lockId = lockId;
    });
    await this.#lockProvider.acquire(lockId);
  }

  async #withLock<ReturnValue>(
    fn: () => Promise<ReturnValue>,
  ): Promise<ReturnValue> {
    const run = this.#lock.then(fn, fn);
    this.#lock = run.then(
      () => undefined,
      () => undefined,
    );
    return await run;
  }
}

/**
 * Every remaining escrow refused the mutation. Even with receipts from other
 * escrows, retrying cannot help: the mutation is obsolete, or another
 * operation already repaired it.
 *
 * @param results - Settled apply results for the remaining escrows.
 * @returns The first refusal, or `null` when the write may have been applied.
 */
function unanimousMutationRejection(
  results: PromiseSettledResult<MutationReceipt>[],
): MutationRejectedError | null {
  let rejection: MutationRejectedError | null = null;
  for (const result of results) {
    if (
      result.status !== 'rejected' ||
      !(result.reason instanceof MutationRejectedError)
    ) {
      return null;
    }
    rejection ??= result.reason;
  }
  return rejection;
}

/**
 * @param replicas - Escrow reads.
 * @throws `replica_lagging` when the escrows are at different versions.
 */
function assertSameVersion(replicas: GetIdentifiersResponse[]): void {
  if (new Set(replicas.map(({ version }) => version)).size > 1) {
    throw new MfaRecoveryError(
      'Escrows are at different versions; call resume with an identifier',
      'replica_lagging',
    );
  }
}

/**
 * @param writing - Writing pending mutation.
 * @param replicas - Reads of the escrows to write.
 * @returns The payload's SIWE identifiers some escrow has not enrolled.
 */
function findNewSiweIdentifiers(
  writing: WritingPendingOperation,
  replicas: GetIdentifiersResponse[],
): Identifier[] {
  const { mutation, payload } = writing;
  const siweIdentifiers = pendingPayloadHasIdentifiers(payload)
    ? payload.identifiers.filter(({ type }) => type === 'siwe')
    : [];
  if (mutation.operation === 'register') {
    return siweIdentifiers;
  }
  return siweIdentifiers.filter(
    (identifier) => !isEnrolledInEvery(replicas, identifier),
  );
}

/**
 * Escrows compare SIWE addresses case-insensitively.
 *
 * @param replicas - Escrow reads.
 * @param identifier - Identifier to find.
 * @returns Whether every escrow has enrolled `identifier`.
 */
function isEnrolledInEvery(
  replicas: GetIdentifiersResponse[],
  identifier: Identifier,
): boolean {
  const { type, namespace, value } = identifier;
  const normalize = (raw: string): string =>
    type === 'siwe' ? raw.toLowerCase() : raw;
  return replicas.every(({ identifiers }) =>
    identifiers.some(
      (other) =>
        other.type === type &&
        other.namespace === namespace &&
        normalize(other.value) === normalize(value),
    ),
  );
}
