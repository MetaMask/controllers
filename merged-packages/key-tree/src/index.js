const bip39 = require('bip39');

const derivers = require('./derivers');

module.exports = {
  deriveKeyFromPath,
  mnemonicToSeed,
};

/**
 * ethereum default seed path: "m/44'/60'/0'/0/{account_index}"
 * multipath: "bip32:44'/bip32:60'/bip32:0'/bip32:0/bip32:{account_index}"
 *
 * m: { privateKey, chainCode } = sha512Hmac("Bitcoin seed", masterSeed)
 * 44': { privateKey, chainCode } = parentKey.privateKey + sha512Hmac(parentKey.chainCode, [0x00, parentKey.privateKey, index + HARDENED_OFFSET])
 * 60': { privateKey, chainCode } = parentKey.privateKey + sha512Hmac(parentKey.chainCode, [0x00, parentKey.privateKey, index + HARDENED_OFFSET])
 * 0': { privateKey, chainCode } = parentKey.privateKey + sha512Hmac(parentKey.chainCode, [0x00, parentKey.privateKey, index + HARDENED_OFFSET])
 * 0: { privateKey, chainCode } = parentKey.privateKey + sha512Hmac(parentKey.chainCode, [parentKey.publicKey, index])
 * 0: { privateKey, chainCode } = parentKey.privateKey + sha512Hmac(parentKey.chainCode, [parentKey.publicKey, index])
 */

/**
 * e.g.
 * -  bip32:0
 * -  bip32:0'
 */
const BIP_32_PATH_REGEX = /^bip32:\d+'?$/u;

/**
 * bip39:<SPACE_DELMITED_SEED_PHRASE>
 *
 * The seed phrase must consist of 12 <= 24 words.
 */
const BIP_39_PATH_REGEX = /^bip39:(\w+){1}( \w+){11,23}$/u;

/**
 * e.g.
 * -  bip32:44'/bip32:60'/bip32:0'/bip32:0/bip32:0
 * -  bip39:<SPACE_DELMITED_SEED_PHRASE>/bip32:44'/bip32:60'/bip32:0'/bip32:0/bip32:0
 */
const MULTI_PATH_REGEX = /^(bip39:(\w+){1}( \w+){11,23}\/)?(bip32:\d+'?\/){3,4}(bip32:\d+'?)$/u;

function validateDeriveKeyParams(pathSegment, parentKey) {
  // The path segment must be one of the following:
  // - A lone BIP-32 path segment
  // - A lone BIP-39 path segment
  // - A multipath
  if (!(
    BIP_32_PATH_REGEX.test(pathSegment) ||
    BIP_39_PATH_REGEX.test(pathSegment) ||
    MULTI_PATH_REGEX.test(pathSegment)
  )) {
    throw new Error('Invalid HD path segment. Ensure that the HD path segment is correctly formatted.');
  }

  // BIP-39 segments can only initiate HD paths
  if (BIP_39_PATH_REGEX.test(pathSegment) && parentKey) {
    throw new Error('May not specify parent key and BIP-39 path segment.');
  }

  // BIP-32 segments cannot initiate HD paths
  if (!pathSegment.startsWith('bip39') && !parentKey) {
    throw new Error('Must specify parent key if the first path of the path segment is not BIP-39.');
  }

  // The parent key must be a Buffer
  if (parentKey && !Buffer.isBuffer(parentKey)) {
    throw new Error('Parent key must be a Buffer if specified.');
  }
}

/**
 * @param {string} pathSegment - A full or leaf HD path segment. If full,
 * optionally preceded by "bip39:<SPACE_DELIMITED_SEED_PHRASE>/".
 * @param {Buffer} [parentKey] - The parent key of the given path segment.
 */
function deriveKeyFromPath(pathSegment, parentKey) {
  validateDeriveKeyParams(pathSegment, parentKey);

  let key = parentKey;

  // derive through each part of path
  pathSegment.split('/').forEach((path) => {
    const [pathType, pathValue] = path.split(':');
    const deriver = derivers[pathType];
    if (!deriver) {
      throw new Error(`Unknown derivation type "${pathType}"`);
    }
    const childKey = deriver.deriveChildKey(key, pathValue);
    // continue deriving from child key
    key = childKey;
  });

  return key;
}

function mnemonicToSeed(mnemonic) {
  return bip39.mnemonicToSeed(mnemonic);
}
