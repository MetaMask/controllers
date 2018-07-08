// node
const crypto = require('crypto')
const assert = require('assert')
// npm
const secp256k1 = require('secp256k1')
const createKeccakHash = require('keccak')

const ROOT_BASE_SECRET = Buffer.from('Bitcoin seed', 'utf8')
const HARDENED_OFFSET = 0x80000000

module.exports = {
  // standard
  deriveChildKey,
  // utility
  bip32PathToMultipath,
  privateKeyToEthAddress,
}

function bip32PathToMultipath(bip32Path) {
  let pathParts = bip32Path.split('/')
  // strip "m" noop
  if (pathParts[0].toLowerCase() === 'm') pathParts = pathParts.slice(1)
  const multipath = pathParts.map(part => 'bip32:' + part).join('/')
  return multipath
}

function deriveChildKey (parentKey, pathPart) {
  const isHardened = pathPart.includes(`'`)
  const indexPart = pathPart.split(`'`)[0]
  const childIndex = parseInt(indexPart, 10)
  assert(childIndex < HARDENED_OFFSET, 'Invalid index')

  const parentPrivateKey = parentKey.slice(0, 32)
  const parentExtraEntropy = parentKey.slice(32)
  const secretExtension = deriveSecretExtension({ parentPrivateKey, childIndex, isHardened })

  const { privateKey, extraEntropy } = generateKey({
    parentPrivateKey,
    parentExtraEntropy,
    secretExtension,
  })

  return Buffer.concat([privateKey, extraEntropy])
}

// the bip32 secret extension is created from the parent private or public key and the child index
function deriveSecretExtension ({ parentPrivateKey, childIndex, isHardened }) {
  if (isHardened) {
    // Hardened child
    const indexBuffer = Buffer.allocUnsafe(4)
    indexBuffer.writeUInt32BE(childIndex + HARDENED_OFFSET, 0)
    const pk = parentPrivateKey
    const zb = Buffer.alloc(1, 0)
    return Buffer.concat([zb, pk, indexBuffer])
  } else {
    // Normal child
    const indexBuffer = Buffer.allocUnsafe(4)
    indexBuffer.writeUInt32BE(childIndex, 0)
    const parentPublicKey = secp256k1.publicKeyCreate(parentPrivateKey, true)
    return Buffer.concat([parentPublicKey, indexBuffer])
  }
}

function generateKey ({ parentPrivateKey, parentExtraEntropy, secretExtension }) {
  const entropy = crypto.createHmac('sha512', parentExtraEntropy).update(secretExtension).digest()
  const keyMaterial = entropy.slice(0, 32)
  // extraEntropy is also called "chaincode"
  const extraEntropy = entropy.slice(32)
  const privateKey = secp256k1.privateKeyTweakAdd(parentPrivateKey, keyMaterial)
  return { privateKey, extraEntropy }
}

function keccak (a, bits = 256) {
  return createKeccakHash('keccak' + bits).update(a).digest()
}

function privateKeyToEthAddress(keyBuffer) {
  const privateKey = keyBuffer.slice(0, 32)
  const publicKey = secp256k1.publicKeyCreate(privateKey, false).slice(1)
  return keccak(publicKey).slice(-20)
}
