// node
const crypto = require('crypto')
// npm
const bip39 = require('bip39')

const ROOT_BASE_SECRET = Buffer.from('Bitcoin seed', 'utf8')

module.exports = {
  // standard
  deriveChildKey,
  // utility
  bip39MnemonicToMultipath,
}

function bip39MnemonicToMultipath(mnemonic) {
  return `bip39:${mnemonic}`
}

// this creates a child key using bip39, ignoring the parent key
function deriveChildKey (parentKey, pathPart) {
  const mnemonic = pathPart
  const seedBuffer = bip39.mnemonicToSeed(mnemonic)
  const entropy = crypto.createHmac('sha512', ROOT_BASE_SECRET).update(seedBuffer).digest()
  const privateKey = entropy.slice(0, 32)
  // also called "chaincode"
  const extraEntropy = entropy.slice(32)

  return entropy
}
