import { hash } from './crypto.js';
import { MfaRecoveryError } from './errors.js';
import type {
  AuthControllerToken,
  GetIdentifiersResponse,
  Identifier,
  RecoveryEscrowProvider,
} from './types.js';

type RepairPlan = {
  /** Highest escrow version. */
  epoch: number;
  /** Whether each escrow, in read order, is one version behind. */
  lagging: boolean[];
  /** Identifiers of the highest record. */
  identifiers: Identifier[];
  /** Whether copying the identifiers alone repairs the lagging escrows. */
  identifiersOnly: boolean;
};

/**
 * Reads every escrow's identifiers and version. Every escrow must answer; a
 * missing record reads as version 0.
 *
 * @param escrows - Escrows to read.
 * @param token - AuthController token for the read.
 * @returns Each escrow's read, in `escrows` order.
 */
export async function getEscrowIdentifiers(
  escrows: RecoveryEscrowProvider[],
  token: AuthControllerToken,
): Promise<GetIdentifiersResponse[]> {
  return await Promise.all(
    escrows.map(async (escrow) => await escrow.getIdentifiers(token)),
  );
}

/**
 * Ensures every escrow is at the same version before a read or mutation.
 *
 * @param records - Escrow records.
 * @throws `replica_lagging` when the escrows are at different versions.
 */
export function assertSameVersion(records: GetIdentifiersResponse[]): void {
  if (new Set(records.map(({ version }) => version)).size > 1) {
    throw new MfaRecoveryError(
      'Escrows are at different versions; call resume with an identifier',
      'replica_lagging',
    );
  }
}

/**
 * Matches on type, namespace and value; SIWE addresses compare
 * case-insensitively, as escrows do.
 *
 * @param records - Escrow records.
 * @param identifier - Identifier to find.
 * @returns Whether every escrow has enrolled `identifier`.
 */
export function isEnrolledInEvery(
  records: GetIdentifiersResponse[],
  identifier: Identifier,
): boolean {
  const { type, namespace, value } = identifier;
  const normalize = (raw: string): string =>
    type === 'siwe' ? raw.toLowerCase() : raw;
  return records.every(({ identifiers }) =>
    identifiers.some(
      (other) =>
        other.type === type &&
        other.namespace === namespace &&
        normalize(other.value) === normalize(value),
    ),
  );
}

/**
 * Ensures every escrow has enrolled the identifier before a write. Escrows
 * fail a write for an unknown identifier, and a failed write stays pending.
 *
 * @param records - Escrow records.
 * @param identifier - Identifier to find. `null` skips the check.
 * @throws `identifier_not_enrolled` when an escrow has not enrolled it.
 */
export function assertEnrolledInEvery(
  records: GetIdentifiersResponse[],
  identifier: Identifier | null,
): void {
  if (identifier && !isEnrolledInEvery(records, identifier)) {
    throw new MfaRecoveryError(
      'Identifier is not enrolled on every escrow',
      'identifier_not_enrolled',
    );
  }
}

/**
 * Plans the write that brings escrows one version behind the highest up to it.
 *
 * @param records - Records of every escrow.
 * @returns The plan, or `null` when every escrow is at the same version.
 * @throws `replica_corruption` when escrows are more than one version apart,
 * or the highest records disagree.
 */
export async function planRepair(
  records: GetIdentifiersResponse[],
): Promise<RepairPlan | null> {
  const epoch = Math.max(...records.map(({ version }) => version));
  if (records.some(({ version }) => version < epoch - 1)) {
    throw new MfaRecoveryError(
      'Escrows are more than one version apart',
      'replica_corruption',
    );
  }
  const lagging = records.map(({ version }) => version < epoch);
  if (!lagging.includes(true)) {
    return null;
  }
  const hashes = await Promise.all(
    records.map(async ({ identifiers }) => await hash(identifiers)),
  );
  if (new Set(hashes.filter((_, index) => !lagging[index])).size > 1) {
    throw new MfaRecoveryError(
      'Escrows at the highest version have different identifiers',
      'replica_corruption',
    );
  }
  const leader = records[lagging.indexOf(false)];
  return {
    epoch,
    lagging,
    identifiers: leader.identifiers,
    identifiersOnly: epoch > 1 && new Set(hashes).size > 1,
  };
}
