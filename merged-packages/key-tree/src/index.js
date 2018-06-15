// node
const crypto = require('crypto')
const assert = require('assert')
// npm
const bip39 = require('bip39')
const secp256k1 = require('secp256k1')
const createKeccakHash = require('keccak')

const ROOT_BASE_SECRET = Buffer.from('Bitcoin seed', 'utf8')
const HARDENED_OFFSET = 0x80000000

module.exports = {
  mnemonicToSeed,
  fromMasterSeed,
  deriveKeyFromPath,
  privateKeyToEthAddress,
}


/*
ethereum default seed path: m/44'/60'/0'/0/{account_index}

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

function fromMasterSeed(seedBuffer) {
  const rootEntropy = crypto.createHmac('sha512', ROOT_BASE_SECRET).update(seedBuffer).digest()

  const key = generateKey({
    baseSecret: ROOT_BASE_SECRET,
    secretExtension: seedBuffer,
  })

  return key
}

function deriveKeyFromPath(_key, path) {
  let key = _key

  path.split('/').forEach((pathPart) => {
    const childKey = deriveChildKey(key, pathPart)
    // continue deriving from child key
    key = childKey
  })

  return key
}

function deriveChildKey (parentKey, pathPart) {
  if (pathPart === 'm' || pathPart === 'M') {
    return parentKey
  }

  const isHardened = (pathPart.length > 1) && (pathPart[pathPart.length - 1] === "'")
  let childIndex = parseInt(pathPart, 10)
  // console.log(`pathPart: #${index} "${pathPart}" isHardened? ${isHardened} childIndex: ${childIndex}`)
  assert(childIndex < HARDENED_OFFSET, 'Invalid index')

  let data
  if (isHardened) {
    // Hardened child
    const indexBuffer = Buffer.allocUnsafe(4)
    indexBuffer.writeUInt32BE(childIndex + HARDENED_OFFSET, 0)
    let pk = parentKey.privateKey
    const zb = Buffer.alloc(1, 0)
    pk = Buffer.concat([zb, pk])
    data = Buffer.concat([pk, indexBuffer])
  } else {
    // Normal child
    const indexBuffer = Buffer.allocUnsafe(4)
    indexBuffer.writeUInt32BE(childIndex, 0)
    data = Buffer.concat([parentKey.publicKey, indexBuffer])
  }

  const childKey = generateKey({
    baseSecret: parentKey.chainCode,
    secretExtension: data,
    parentPrivateKey: parentKey.privateKey
  })

  return childKey
}

function generateKey ({ baseSecret, secretExtension, parentPrivateKey }) {
  const entropy = crypto.createHmac('sha512', baseSecret).update(secretExtension).digest()
  const keyMaterial = entropy.slice(0, 32)
  const chainCode = entropy.slice(32)

  const privateKey = parentPrivateKey ? secp256k1.privateKeyTweakAdd(parentPrivateKey, keyMaterial) : keyMaterial
  const publicKey = secp256k1.publicKeyCreate(privateKey, true)

  return { chainCode, privateKey, publicKey }
}

function keccak (a, bits = 256) {
  return createKeccakHash('keccak' + bits).update(a).digest()
}

function privateKeyToEthAddress(privateKey) {
  const publicKey = secp256k1.publicKeyCreate(privateKey, false).slice(1)
  return keccak(publicKey).slice(-20)
}

function logKey(key) {
  console.log('privateKey', key.privateKey.toString('hex'))
  console.log('publicKey', key.publicKey.toString('hex'))
  console.log('chainCode', key.chainCode.toString('hex'))
  const address = privateKeyToEthAddress(key.privateKey)
  console.log('address', address.toString('hex'))
}
