import { hash } from './crypto.js';
import { MfaRecoveryError } from './errors.js';
import type { GetIdentifiersResponse, Identifier } from './types.js';

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
 * @param replicas - Escrow reads.
 * @throws `replica_lagging` when the escrows are at different versions.
 */
export function assertSameVersion(replicas: GetIdentifiersResponse[]): void {
  if (new Set(replicas.map(({ version }) => version)).size > 1) {
    throw new MfaRecoveryError(
      'Escrows are at different versions; call resume with an identifier',
      'replica_lagging',
    );
  }
}

/**
 * Escrows compare SIWE addresses case-insensitively.
 *
 * @param replicas - Escrow reads.
 * @param identifier - Identifier to find.
 * @returns Whether every escrow has enrolled `identifier`.
 */
export function isEnrolledInEvery(
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

/**
 * Plans the write that brings escrows one version behind the highest up to it.
 *
 * @param replicas - Reads of every escrow.
 * @returns The plan, or `null` when every escrow is at the same version.
 * @throws `replica_corruption` when escrows are more than one version apart,
 * or the highest records disagree.
 */
export async function planRepair(
  replicas: GetIdentifiersResponse[],
): Promise<RepairPlan | null> {
  const epoch = Math.max(...replicas.map(({ version }) => version));
  if (replicas.some(({ version }) => version < epoch - 1)) {
    throw new MfaRecoveryError(
      'Escrows are more than one version apart',
      'replica_corruption',
    );
  }
  const lagging = replicas.map(({ version }) => version < epoch);
  if (!lagging.includes(true)) {
    return null;
  }
  const hashes = await Promise.all(
    replicas.map(async ({ identifiers }) => await hash(identifiers)),
  );
  if (new Set(hashes.filter((_, index) => !lagging[index])).size > 1) {
    throw new MfaRecoveryError('Replica corruption', 'replica_corruption');
  }
  const leader = replicas[lagging.indexOf(false)];
  return {
    epoch,
    lagging,
    identifiers: leader.identifiers,
    identifiersOnly: epoch > 1 && new Set(hashes).size > 1,
  };
}
