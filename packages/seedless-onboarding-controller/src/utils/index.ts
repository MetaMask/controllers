export {
  assertIsEncryptedKeyringEncryptionKeySet,
  assertIsEncryptedSeedlessEncryptionKeySet,
  assertIsPasswordOutdatedCacheValid,
  assertIsSeedlessOnboardingUserAuthenticated,
  assertIsValidPassword,
} from './assertions.js';
export { trackIncompleteMetadataBackupEvents } from './analytics.js';
export type { SecretBackupData } from './secret-data-utils.js';
export {
  getDataTypeMigrationUpdates,
  getNewSocialBackupsMetadata,
  parseAndValidateSecretMetadataBackup,
} from './secret-data-utils.js';
export {
  RECOVERY_KEYS_PREFIX,
  RECOVERY_KEYS_SECRET_TYPE,
  TOPRF_RECOVERY_VERIFIER,
  WRAPPED_KEYS_PREFIX,
  derivePubKey,
  isRecoveryKeysItem,
  parseRecoveryKeys,
  parseRecoveryKeysItem,
  parseWrappedKeys,
  pubKeysEqual,
  serializeRecoveryKeys,
  serializeRecoveryKeysItem,
  serializeWrappedKeys,
  isWrapCurrent,
} from '../mfa-recovery/recovery-keys.js';
export type {
  RecoveryKeys,
  WrappedKeySet,
} from '../mfa-recovery/recovery-keys.js';
export {
  compareAndGetLatestToken,
  decodeJWTToken,
  decodeNodeAuthToken,
  deserializeVaultData,
  getInvalidPrimarySecretDataTypeErrorData,
  getSecretTypeFromDataType,
  isAuthTokenError,
  isCouldNotDeriveEncryptionKeyError,
  isMaxKeyChainLengthError,
  isTokenNearExpiry,
  parseVaultData,
  serializeVaultData,
} from './utils.js';
