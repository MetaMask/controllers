# @metamask/key-tree

An interface over [BIP-44] key derivation paths.

## Installation

`yarn add @metamask/key-tree`

or

`npm install @metamask/key-tree`

## Usage

This package is designed to accommodate the creation of keys for any level of a BIP-44 path.
Recall that a BIP-44 HD tree path consists of the following nodes (and depths):

> `m / 44' / coin_type' / account' / change / address_index`
>
> `0 / 1 / 2 / 3 / 4 / 5`

Where `m` is the "master" or seed node, `coin_type` indicates the protocol for which deeper keys are intended,
and `address_index` usually furnishes key pairs intended for user addresses / accounts.
For details, refer to the [BIP-44] specification.
For the authoritative list of protocol `coin_type` indices, see [SLIP-44].

This package exports two classes intended to facilitate the creation of keys in contexts with different privileges.
They are used as follows.

```typescript
import { BIP44CoinTypeNode } from '@metamask/key-tree';

// Per SLIP-44, Ethereum has a coin_type of 60.
// Ethereum is only used by way of example.
const coinType = 60;

// Imagine that this takes place in some privileged context with access to
// the user's mnemonic.
const mnemonic = getMnemonic();

const coinTypeNode = new BIP44CoinTypeNode([
  `bip39:${mnemonic}`,
  `bip32:44'`, // By BIP-44, the "purpose" node must be "44'"
  `bip32:${coinType}'`,
]);

// Imagine that this is some Node.js stream, but it could be anything that
// can transmit JSON messages, such as window.postMessage.
stream.write(coinTypeNode.toJSON());

//===============================
// Then, on the receiving end...
//===============================

import { getBIP44AddressKeyDeriver } from '@metamask/key-tree';

// Get the node sent from the privileged context.
// It will have the following shape:
//   {
//     key, // A Base64 string of the coin_type key
//     depth, // The number 2, which is the depth of coin_type nodes
//     coin_type, // In this case, the number 60
//     path, // For visualization only. In this case: m / 44' / 60'
//   }
const coinTypeNode = await getCoinTypeNode();

// Get an address key deriver for the coin_type node.
// In this case, its path will be: m / 44' / 60' / 0' / 0 / address_index
const addressKeyDeriver = getBIP44AddressKeyDeriver(coinTypeNode);

// These are Node.js Buffer representations of the extended private keys for
// the respective addresses.

// m / 44' / 60' / 0' / 0 / 0
const addressKey0 = addressKeyDeriver(0);

// m / 44' / 60' / 0' / 0 / 1
const addressKey1 = addressKeyDeriver(1);

// Now, the extended private keys can be used to derive the corresponding public
// keys and protocol addresses.
```

There are other ways of deriving keys in addition to the above example.
See the docstrings in the [BIP44Node](./src/BIP44Node.ts) and [BIP44CoinTypeNode](./src/BIP44CoinTypeNode.ts) files for details.

### Internals

This package also has methods for deriving arbitrary BIP-32 keys, and generating seeds from BIP-39 mnemonics.
These methods do not constitute a safe key derivation API, and their use is **strongly discouraged**.
Nevertheless, since those methods were the main exports of this package prior to version `3.0.0`, consumers can
still access them by importing `@metamask/key-tree/derivation`.

## Security

This package is rigorously tested against reference implementations and the [BIP-32] specification.
See the [reference implementation tests](./test/reference-implementations.test.ts) for details.

## Further Reading

- [BIP-32]
- [BIP-39]
- [BIP-44]
- [SLIP-44]
- Network Working Group: ["Key Derivation Functions and their Uses"](https://trac.tools.ietf.org/html/draft-irtf-cfrg-kdf-uses-00)

[bip-32]: https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
[bip-39]: https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki
[bip-44]: https://github.com/bitcoin/bips/blob/master/bip-0044.mediawiki
[slip-44]: https://github.com/satoshilabs/slips/blob/master/slip-0044.md
