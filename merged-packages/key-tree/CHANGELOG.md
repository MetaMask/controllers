# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [10.0.1]

### Fixed

- Export `CryptographicFunctions` type ([#202](https://github.com/MetaMask/key-tree/pull/202))

## [10.0.0]

### Added

- Add network property to `SLIP10Node`, `BIP44Node`, and `BIP44CoinTypeNode` ([#200](https://github.com/MetaMask/key-tree/pull/200))
  - The network property is only used to determine which BIP-32 extended key version to use.
  - For backwards compatibility, the property is optional, and defaults to `mainnet`.
- Add option for custom cryptographic functions ([#197](https://github.com/MetaMask/key-tree/pull/197))
  - It's now possible to specify custom functions (`hmacSha512` and `pbkdf2Sha512`) to improve performance.
- Add `extendedKey` property to `SLIP10Node` ([#196](https://github.com/MetaMask/key-tree/pull/196))
  - This property can only be accessed on `SLIP10Node`s using `secp256k1`.

### Changed

- **BREAKING:** Bump minimum Node version to `18.20` ([#198](https://github.com/MetaMask/key-tree/pull/198))
- Use WebCrypto API if available ([#197](https://github.com/MetaMask/key-tree/pull/197))
- Bump `@metamask/utils` from `9.0.0` to `9.3.0` ([#191](https://github.com/MetaMask/key-tree/pull/191))

## [9.1.2]

### Changed

- Bump `@metamask/utils` from `^8.3.0` to `^9.0.0` ([#181](https://github.com/MetaMask/key-tree/pull/181))

## [9.1.1]

### Fixed

- Fix ESM imports ([#177](https://github.com/MetaMask/key-tree/pull/177))

## [9.1.0]

### Added

- Add support for Cardano key derivation according to CIP3-Icarus ([#158](https://github.com/MetaMask/key-tree/pull/158), [#170](https://github.com/MetaMask/key-tree/pull/170), [#171](https://github.com/MetaMask/key-tree/pull/171), [#172](https://github.com/MetaMask/key-tree/pull/172))
- Export `getBIP44CoinTypeToAddressPathTuple` function ([#173](https://github.com/MetaMask/key-tree/pull/173))

### Changed

- Replace `@noble/ed25519` and `@noble/secp256k1` with `@noble/curves` ([#154](https://github.com/MetaMask/key-tree/pull/154))
- Bump several MetaMask dependencies ([#151](https://github.com/MetaMask/key-tree/pull/151), [#165](https://github.com/MetaMask/key-tree/pull/165), [#167](https://github.com/MetaMask/key-tree/pull/167))

## [9.0.0]

### Changed

- **BREAKING:** Disallow importing from `./dist` paths ([#147](https://github.com/MetaMask/key-tree/pull/147))
- Export `mnemonicPhraseToBytes` and `createBip39KeyFromSeed` ([#149](https://github.com/MetaMask/key-tree/pull/149))

### Fixed

- Add support for Node.js with ESM ([#147](https://github.com/MetaMask/key-tree/pull/147))
- Remove `postinstall` script ([#146](https://github.com/MetaMask/key-tree/pull/146))
  - This caused installation to fail.

## [8.0.0]

### Changed

- **BREAKING:** Build the package as both CJS and ESM ([#140](https://github.com/MetaMask/key-tree/pull/139))
  - Distribution files have been moved from `dist` to `dist/cjs` (and `dist/esm`). If you are explicitly importing from `dist`, you have to update the import.
- Bump `@metamask/utils` to `6.2.0` ([#140](https://github.com/MetaMask/key-tree/pull/140))

## [7.1.1]

### Fixed

- Fix `isValidBIP32PathSegment` to correctly check if BIP-32 path segment is `<= 2^31-1` ([#134](https://github.com/MetaMask/key-tree/pull/134))

## [7.1.0]

### Added

- Add `isValidBIP32PathSegment` function ([#131](https://github.com/MetaMask/key-tree/pull/131))

### Changed

- Bump `@metamask/utils` to `6.0.1` ([#132](https://github.com/MetaMask/key-tree/pull/132))

## [7.0.0]

### Added

- **BREAKING:** Add SLIP-10 (`slip10:`) path type ([#124](https://github.com/MetaMask/key-tree/pull/124))
  - `bip32:` can no longer be used to derive ed25519 keys

### Changed

- Handle errors when resulting public or private key is invalid ([#120](https://github.com/MetaMask/key-tree/pull/120))
  - Rather than throwing an error, a new key will be derived instead, as per the SLIP-10 or BIP-32 specification
- Improve extended key validation ([#121](https://github.com/MetaMask/key-tree/pull/121))
- Validate that master private key and seed are within bounds ([#118](https://github.com/MetaMask/key-tree/pull/118))
- Allow zero private key for `ed25519` ([#122](https://github.com/MetaMask/key-tree/pull/122))
  - Previously a zero private key `0x000..000` would be rejected when using ed25519, but all private keys are valid for ed25519

## [6.2.1]

### Fixed

- Add missing curve parameter ([#110](https://github.com/MetaMask/key-tree/pull/110))
  - This fixes a bug introduced in 6.2.0, when using the ed25519 curve.

## [6.2.0]

### Added

- Accept BIP-39 secret recovery phrase as Uint8Array ([#107](https://github.com/MetaMask/key-tree/pull/107))
  - Secret recovery phrases are now accepted both as a string in the `bip39:...` format, and as `Uint8Array` in the format used by [`@metamask/scure-bip39`](https://github.com/MetaMask/scure-bip39), in all functions that accept secret recovery phrases.

## [6.1.0]

### Changed

- Update BIP-39 implementation from `@scure/bip39` to MetaMask fork version `@metamask/scure-bip39` ([#101](https://github.com/MetaMask/key-tree/pull/101))
  - The `@metamask/scure-bip39` fork accepts secret recovery phrases in `Uint8Array` format making it possible to use more secure patterns of passing secret recovery phrases around. This change is non-breaking however, as the `mnemonicToSeed` function used in this package still accepts secret recovery phrases in string format.

## [6.0.0]

### Changed

- **BREAKING:** Rename all occurrences of `Buffer` with `Bytes` or `Uint8Array` ([#84](https://github.com/MetaMask/key-tree/pull/84))
  - All `[...]Buffer` fields have been replaced with `[...]Bytes`, e.g., `BIP44Node.privateKeyBuffer` is now `BIP44Node.privateKeyBytes`.
  - This change does not affect the string fields, like `BIP44Node.privateKey`.
- BREAKING: Swap out Buffer with browser-compatible Uint8Array ([#83](https://github.com/MetaMask/key-tree/pull/83))
  - All functions returning `Buffer`s now return `Uint8Array`s instead.
- Bump @metamask/utils to 3.3.0 ([#85](https://github.com/MetaMask/key-tree/pull/85))

## [5.0.2]

### Fixed

- Export Buffer from `buffer` package explicitly ([#76](https://github.com/MetaMask/key-tree/pull/76))
- Fix fingerprint derivation ([#78](https://github.com/MetaMask/key-tree/pull/78))

## [5.0.1]

### Fixed

- Replace postinstall script with Yarn plugin ([#74](https://github.com/MetaMask/key-tree/pull/74))

## [5.0.0]

### Added

- Add convenience field for getting the compressed public key ([#71](https://github.com/MetaMask/key-tree/pull/71))
- Add master fingerprint field to `SLIP10Node` ([#68](https://github.com/MetaMask/key-tree/pull/68))

### Changed

- **BREAKING:** Bump minimum Node version to 16 and migrate to Yarn 3 ([#70](https://github.com/MetaMask/key-tree/pull/70))
- Allow a depth larger than 5 for SLIP-10 nodes ([#69](https://github.com/MetaMask/key-tree/pull/69))

## [4.0.0]

### Added

- **NOTE:** This version is a significant rewrite of this package, and virtually all existing usage will break upon migrating from a previous major version.
  All pre-existing functionality is supported through different means, and various new features have been added.
- Add extended public (`xpub`) and private (`xprv`) keys ([#58](https://github.com/MetaMask/key-tree/pull/58))
- Add support for public key derivation ([#56](https://github.com/MetaMask/key-tree/pull/56))
- Add support for non-secp256k1 curves via `SLIP10Node` class ([#43](https://github.com/MetaMask/key-tree/pull/43), [#37](https://github.com/MetaMask/key-tree/pull/37), [#53](https://github.com/MetaMask/key-tree/pull/53))
  - Add support for ed25519 curve.
  - With this and other changes in this release, this package offers full [SLIP-10](https://github.com/satoshilabs/slips/blob/133ea52a8e43d338b98be208907e144277e44c0e/slip-0010.md) support for all curves except nist256p1.
  - These changes were made possible using the `@noble/*` suite of cryptography packages.
- Add extended key to BIP-44 coin type node ([#59](https://github.com/MetaMask/key-tree/pull/59))
- Add convenience methods to get public keys and addresses ([#50](https://github.com/MetaMask/key-tree/pull/50))
- Enable deriving hardened `change` and `address_index` using `BIP44CoinTypeNode` ([#37](https://github.com/MetaMask/key-tree/pull/37))

### Changed

- **BREAKING:** Change key representation format ([#58](https://github.com/MetaMask/key-tree/pull/58), [#54](https://github.com/MetaMask/key-tree/pull/54))
  - Encode string keys in hexadecimal instead of Base64.
  - Always return a `SLIP10Node` (or child class) object from derivation functions.
- **BREAKING:** Separate private keys and chain code into separate fields ([#54](https://github.com/MetaMask/key-tree/pull/54))
- **BREAKING:** Use named arguments instead of positional arguments in various functions ([#56](https://github.com/MetaMask/key-tree/pull/56))
- **BREAKING:** Make all derivation functions async ([#43](https://github.com/MetaMask/key-tree/pull/43), [#54](https://github.com/MetaMask/key-tree/pull/54))
  - All key derivation functions are now async, and node objects are initialized via a static, async `.from(...)` method. This is because some cryptographic dependencies are async.
- Update documentation to match new implementation ([#60](https://github.com/MetaMask/key-tree/pull/60), [#49](https://github.com/MetaMask/key-tree/pull/49))

### Fixed

- Remove obsolete Jest snapshots ([#41](https://github.com/MetaMask/key-tree/pull/41))
- Replace node symbol with private field ([#42](https://github.com/MetaMask/key-tree/pull/42))

## [3.0.1]

### Changed

- Update cryptography dependencies ([#29](https://github.com/MetaMask/key-tree/pull/29), [#30](https://github.com/MetaMask/key-tree/pull/30), [#31](https://github.com/MetaMask/key-tree/pull/31))
  - This results in an overall ~4x speedup in Node.js for operations with this package. Browser performance gains, if any, are not known at this time.
  - Individual pull requests:
    - `bip39@3.0.4` ([#29](https://github.com/MetaMask/key-tree/pull/29))
    - `secp256k1@4.0.2` ([#30](https://github.com/MetaMask/key-tree/pull/30))
    - `keccak@3.0.2` ([#31](https://github.com/MetaMask/key-tree/pull/31))

## [3.0.0]

### Changed

- **BREAKING:** Refactor package API ([#25](https://github.com/MetaMask/key-tree/pull/25))
  - The new API is designed to make it harder to derive incorrect keys.
  - The previous exports of this package can no longer be accessed from the main entry file.
  - For the new API, please see [the README](https://github.com/MetaMask/key-tree/blob/1743ef1bb2ca4603c6e2861b975bf2b4d60a0dbc/README.md).
- **BREAKING:** Bump minimum Node.js version to >=12.0.0 ([#20](https://github.com/MetaMask/key-tree/pull/20))

### Security

- Add reference implementation tests ([#25](https://github.com/MetaMask/key-tree/pull/25))
  - The key derivation of this package is now tested against the BIP-32 specification and [`ethereumjs-wallet`](https://github.com/ethereumjs/ethereumjs-wallet) and [`@metamask/eth-hd-keyring`](https://github.com/MetaMask/eth-hd-keyring).
  - The key derivation was found to be sound.

## [2.0.1] - 2021-02-27

### Fixed

- Correctly type `deriveKeyFromPath` `parentKey` param as optional ([#14](https://github.com/MetaMask/key-tree/pull/14))
- Only accept lowercase BIP-39 seed phrases in `deriveKeyFromPath` ([#15](https://github.com/MetaMask/key-tree/pull/15))

## [2.0.0] - 2021-02-25

### Changed

- **BREAKING:** Add input validation to `deriveKeyFromPath` ([#3](https://github.com/MetaMask/key-tree/pull/3), [#4](https://github.com/MetaMask/key-tree/pull/4))
- **BREAKING:** Change `deriveKeyFromPath` parameter order ([#3](https://github.com/MetaMask/key-tree/pull/3))
- Migrate to TypeScript, update types ([#10](https://github.com/MetaMask/key-tree/pull/10))

## [1.0.0] - 2020-09-03

### Added

- Initial release.

[Unreleased]: https://github.com/MetaMask/key-tree/compare/v10.0.1...HEAD
[10.0.1]: https://github.com/MetaMask/key-tree/compare/v10.0.0...v10.0.1
[10.0.0]: https://github.com/MetaMask/key-tree/compare/v9.1.2...v10.0.0
[9.1.2]: https://github.com/MetaMask/key-tree/compare/v9.1.1...v9.1.2
[9.1.1]: https://github.com/MetaMask/key-tree/compare/v9.1.0...v9.1.1
[9.1.0]: https://github.com/MetaMask/key-tree/compare/v9.0.0...v9.1.0
[9.0.0]: https://github.com/MetaMask/key-tree/compare/v8.0.0...v9.0.0
[8.0.0]: https://github.com/MetaMask/key-tree/compare/v7.1.1...v8.0.0
[7.1.1]: https://github.com/MetaMask/key-tree/compare/v7.1.0...v7.1.1
[7.1.0]: https://github.com/MetaMask/key-tree/compare/v7.0.0...v7.1.0
[7.0.0]: https://github.com/MetaMask/key-tree/compare/v6.2.1...v7.0.0
[6.2.1]: https://github.com/MetaMask/key-tree/compare/v6.2.0...v6.2.1
[6.2.0]: https://github.com/MetaMask/key-tree/compare/v6.1.0...v6.2.0
[6.1.0]: https://github.com/MetaMask/key-tree/compare/v6.0.0...v6.1.0
[6.0.0]: https://github.com/MetaMask/key-tree/compare/v5.0.2...v6.0.0
[5.0.2]: https://github.com/MetaMask/key-tree/compare/v5.0.1...v5.0.2
[5.0.1]: https://github.com/MetaMask/key-tree/compare/v5.0.0...v5.0.1
[5.0.0]: https://github.com/MetaMask/key-tree/compare/v4.0.0...v5.0.0
[4.0.0]: https://github.com/MetaMask/key-tree/compare/v3.0.1...v4.0.0
[3.0.1]: https://github.com/MetaMask/key-tree/compare/v3.0.0...v3.0.1
[3.0.0]: https://github.com/MetaMask/key-tree/compare/v2.0.1...v3.0.0
[2.0.1]: https://github.com/MetaMask/key-tree/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/MetaMask/key-tree/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/MetaMask/key-tree/releases/tag/v1.0.0
