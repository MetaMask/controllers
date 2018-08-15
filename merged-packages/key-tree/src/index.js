// node
const crypto = require('crypto')
const assert = require('assert')
// npm
const bip39 = require('bip39')
const secp256k1 = require('secp256k1')
const createKeccakHash = require('keccak')

const derivers = {
  'bip32': require('./derivers/bip32'),
  'bip39': require('./derivers/bip39'),
}

module.exports = {
  mnemonicToSeed,
  deriveKeyFromPath,
}


/*
ethereum default seed path: "m/44'/60'/0'/0/{account_index}"
multipath: "bip32:44'/bip32:60'/bip32:0'/bip32:0/bip32:{account_index}"

m: { privateKey, chainCode } = sha512Hmac("Bitcoin seed", masterSeed)
44': { privateKey, chainCode } = parentKey.privateKey + sha512Hmac(parentKey.chainCode, [0x00, parentKey.privateKey, index + HARDENED_OFFSET])
60': { privateKey, chainCode } = parentKey.privateKey + sha512Hmac(parentKey.chainCode, [0x00, parentKey.privateKey, index + HARDENED_OFFSET])
0': { privateKey, chainCode } = parentKey.privateKey + sha512Hmac(parentKey.chainCode, [0x00, parentKey.privateKey, index + HARDENED_OFFSET])
0: { privateKey, chainCode } = parentKey.privateKey + sha512Hmac(parentKey.chainCode, [parentKey.publicKey, index])
0: { privateKey, chainCode } = parentKey.privateKey + sha512Hmac(parentKey.chainCode, [parentKey.publicKey, index])
*/

function mnemonicToSeed(mnemonic) {
  return bip39.mnemonicToSeed(mnemonic)
}

function deriveKeyFromPath(_key, fullPath) {
  let key = _key

  const pathParts = fullPath.split('/')

  // derive through each part of path
  pathParts.forEach((path) => {
    const [pathType, pathValue] = path.split(':')
    const deriver = derivers[pathType]
    if (!deriver) throw new Error(`Unknown derivation type "${pathType}"`)
    const childKey = deriver.deriveChildKey(key, pathValue)
    // continue deriving from child key
    key = childKey
  })

  return key
}

function logKey(key) {
  console.log('privateKey', key.privateKey.toString('hex'))
  console.log('publicKey', key.publicKey.toString('hex'))
  console.log('chainCode', key.chainCode.toString('hex'))
  // const address = privateKeyToEthAddress(key.privateKey)
  // console.log('address', address.toString('hex'))
}
