export default {
  // Fixtures defined and used in this package
  local: {
    mnemonic:
      'romance hurry grit huge rifle ordinary loud toss sound congress upset twist',
    addresses: [
      '5df603999c3d5ca2ab828339a9883585b1bce11b',
      '441c07e32a609afd319ffbb66432b424058bcfe9',
      '1f7c93dfe849c06dd610e77473bfaaef7f183c7c',
      '9e28bae18e0e358b12796697c6546f77d4657527',
      '6e7734c7f4fb973a3800b72fb1a6bf82d85d3d29',
      'f87328a8ea5208946c60dbd9385d4c8533ad5dd8',
    ],
  },

  // https://github.com/brave/eth-hd-keyring/blob/482acf341f01a8d1e924d55bfdbd309444a78e46/test/index.js#L10-L12
  // The state of the default branch as of 2021-10-19
  'eth-hd-keyring': {
    mnemonic:
      'finish oppose decorate face calm tragic certain desk hour urge dinosaur mango',
  },

  // https://github.com/ethereumjs/ethereumjs-wallet/blob/2bc21b408da3b002a95aa752b94fa039ffc64e0f/test/hdkey.spec.ts
  // The state of the default branch as of 2021-10-19
  'ethereumjs-wallet': {
    hexSeed:
      '747f302d9c916698912d5f70be53a6cf53bc495803a5523d3a7c3afa2afba94ec3803f838b3e1929ab5481f9da35441372283690fdcf27372c38f40ba134fe03',
    // The path used is modified from the ethereumjs-wallet original, which
    // isn't BIP-44 compatible. Since we're testing against their
    // implementation, not any reference values, this is fine.
    path: {
      ours: {
        tuple: [`bip32:44'`, `bip32:0'`, `bip32:0'`, `bip32:1`],
        string: [`bip32:44'/bip32:0'/bip32:0'/bip32:1`],
      },
      theirs: "m/44'/0'/0'/1",
    },
    sampleAddressIndices: [0, 1, 5, 50, 500, 5000, 4_999_999, 5_000_000],
  },

  // The BIP-32 specification test vectors.
  // https://github.com/bitcoin/bips/blob/f9a81b7791142e31ae9ab2a4e8c796f90cfe9627/bip-0032.mediawiki#test-vectors
  // The state of the default branch as of 2021-10-20
  bip32: [
    // ===Test vector 1===
    {
      hexSeed: '000102030405060708090a0b0c0d0e0f',
      keys: [
        {
          path: {
            ours: {
              tuple: [],
              string: '',
            },
            theirs: 'm',
          },
          extPubKey:
            'xpub661MyMwAqRbcFtXgS5sYJABqqG9YLmC4Q1Rdap9gSE8NqtwybGhePY2gZ29ESFjqJoCu1Rupje8YtGqsefD265TMg7usUDFdp6W1EGMcet8',
          extPrivKey:
            'xprv9s21ZrQH143K3QTDL4LXw2F7HEK3wJUD2nW2nRk4stbPy6cq3jPPqjiChkVvvNKmPGJxWUtg6LnF5kejMRNNU3TGtRBeJgk33yuGBxrMPHi',
        },
        {
          path: {
            ours: {
              tuple: ["bip32:0'"],
              string: "bip32:0'",
            },
            theirs: "m/0'",
          },
          extPubKey:
            'xpub68Gmy5EdvgibQVfPdqkBBCHxA5htiqg55crXYuXoQRKfDBFA1WEjWgP6LHhwBZeNK1VTsfTFUHCdrfp1bgwQ9xv5ski8PX9rL2dZXvgGDnw',
          extPrivKey:
            'xprv9uHRZZhk6KAJC1avXpDAp4MDc3sQKNxDiPvvkX8Br5ngLNv1TxvUxt4cV1rGL5hj6KCesnDYUhd7oWgT11eZG7XnxHrnYeSvkzY7d2bhkJ7',
        },
        {
          path: {
            ours: {
              tuple: ["bip32:0'", 'bip32:1'],
              string: "bip32:0'/bip32:1",
            },
            theirs: "m/0'/1",
          },
          extPubKey:
            'xpub6ASuArnXKPbfEwhqN6e3mwBcDTgzisQN1wXN9BJcM47sSikHjJf3UFHKkNAWbWMiGj7Wf5uMash7SyYq527Hqck2AxYysAA7xmALppuCkwQ',
          extPrivKey:
            'xprv9wTYmMFdV23N2TdNG573QoEsfRrWKQgWeibmLntzniatZvR9BmLnvSxqu53Kw1UmYPxLgboyZQaXwTCg8MSY3H2EU4pWcQDnRnrVA1xe8fs',
        },
        {
          path: {
            ours: {
              tuple: ["bip32:0'", 'bip32:1', "bip32:2'"],
              string: "bip32:0'/bip32:1/bip32:2'",
            },
            theirs: "m/0'/1/2'",
          },
          extPubKey:
            'xpub6D4BDPcP2GT577Vvch3R8wDkScZWzQzMMUm3PWbmWvVJrZwQY4VUNgqFJPMM3No2dFDFGTsxxpG5uJh7n7epu4trkrX7x7DogT5Uv6fcLW5',
          extPrivKey:
            'xprv9z4pot5VBttmtdRTWfWQmoH1taj2axGVzFqSb8C9xaxKymcFzXBDptWmT7FwuEzG3ryjH4ktypQSAewRiNMjANTtpgP4mLTj34bhnZX7UiM',
        },
        {
          path: {
            ours: {
              tuple: ["bip32:0'", 'bip32:1', "bip32:2'", 'bip32:2'],
              string: "bip32:0'/bip32:1/bip32:2'/bip32:2",
            },
            theirs: "m/0'/1/2'/2",
          },
          extPubKey:
            'xpub6FHa3pjLCk84BayeJxFW2SP4XRrFd1JYnxeLeU8EqN3vDfZmbqBqaGJAyiLjTAwm6ZLRQUMv1ZACTj37sR62cfN7fe5JnJ7dh8zL4fiyLHV',
          extPrivKey:
            'xprvA2JDeKCSNNZky6uBCviVfJSKyQ1mDYahRjijr5idH2WwLsEd4Hsb2Tyh8RfQMuPh7f7RtyzTtdrbdqqsunu5Mm3wDvUAKRHSC34sJ7in334',
        },
        {
          path: {
            ours: {
              tuple: [
                "bip32:0'",
                'bip32:1',
                "bip32:2'",
                'bip32:2',
                'bip32:1000000000',
              ],
              string: "bip32:0'/bip32:1/bip32:2'/bip32:2/bip32:1000000000",
            },
            theirs: "m/0'/1/2'/2/1000000000",
          },
          extPubKey:
            'xpub6H1LXWLaKsWFhvm6RVpEL9P4KfRZSW7abD2ttkWP3SSQvnyA8FSVqNTEcYFgJS2UaFcxupHiYkro49S8yGasTvXEYBVPamhGW6cFJodrTHy',
          extPrivKey:
            'xprvA41z7zogVVwxVSgdKUHDy1SKmdb533PjDz7J6N6mV6uS3ze1ai8FHa8kmHScGpWmj4WggLyQjgPie1rFSruoUihUZREPSL39UNdE3BBDu76',
        },
      ],
    },

    // ===Test vector 2===
    {
      hexSeed:
        'fffcf9f6f3f0edeae7e4e1dedbd8d5d2cfccc9c6c3c0bdbab7b4b1aeaba8a5a29f9c999693908d8a8784817e7b7875726f6c696663605d5a5754514e4b484542',
      keys: [
        {
          path: {
            ours: {
              tuple: [],
              string: '',
            },
            theirs: 'm',
          },
          extPubKey:
            'xpub661MyMwAqRbcFW31YEwpkMuc5THy2PSt5bDMsktWQcFF8syAmRUapSCGu8ED9W6oDMSgv6Zz8idoc4a6mr8BDzTJY47LJhkJ8UB7WEGuduB',
          extPrivKey:
            'xprv9s21ZrQH143K31xYSDQpPDxsXRTUcvj2iNHm5NUtrGiGG5e2DtALGdso3pGz6ssrdK4PFmM8NSpSBHNqPqm55Qn3LqFtT2emdEXVYsCzC2U',
        },
        {
          path: {
            ours: {
              tuple: ['bip32:0'],
              string: 'bip32:0',
            },
            theirs: 'm/0',
          },
          extPubKey:
            'xpub69H7F5d8KSRgmmdJg2KhpAK8SR3DjMwAdkxj3ZuxV27CprR9LgpeyGmXUbC6wb7ERfvrnKZjXoUmmDznezpbZb7ap6r1D3tgFxHmwMkQTPH',
          extPrivKey:
            'xprv9vHkqa6EV4sPZHYqZznhT2NPtPCjKuDKGY38FBWLvgaDx45zo9WQRUT3dKYnjwih2yJD9mkrocEZXo1ex8G81dwSM1fwqWpWkeS3v86pgKt',
        },
        {
          path: {
            ours: {
              tuple: ['bip32:0', "bip32:2147483647'"],
              string: "bip32:0/bip32:2147483647'",
            },
            theirs: "m/0/2147483647'",
          },
          extPubKey:
            'xpub6ASAVgeehLbnwdqV6UKMHVzgqAG8Gr6riv3Fxxpj8ksbH9ebxaEyBLZ85ySDhKiLDBrQSARLq1uNRts8RuJiHjaDMBU4Zn9h8LZNnBC5y4a',
          extPrivKey:
            'xprv9wSp6B7kry3Vj9m1zSnLvN3xH8RdsPP1Mh7fAaR7aRLcQMKTR2vidYEeEg2mUCTAwCd6vnxVrcjfy2kRgVsFawNzmjuHc2YmYRmagcEPdU9',
        },
        {
          path: {
            ours: {
              tuple: ['bip32:0', "bip32:2147483647'", 'bip32:1'],
              string: "bip32:0/bip32:2147483647'/bip32:1",
            },
            theirs: "m/0/2147483647'/1",
          },
          extPubKey:
            'xpub6DF8uhdarytz3FWdA8TvFSvvAh8dP3283MY7p2V4SeE2wyWmG5mg5EwVvmdMVCQcoNJxGoWaU9DCWh89LojfZ537wTfunKau47EL2dhHKon',
          extPrivKey:
            'xprv9zFnWC6h2cLgpmSA46vutJzBcfJ8yaJGg8cX1e5StJh45BBciYTRXSd25UEPVuesF9yog62tGAQtHjXajPPdbRCHuWS6T8XA2ECKADdw4Ef',
        },
        {
          path: {
            ours: {
              tuple: [
                'bip32:0',
                "bip32:2147483647'",
                'bip32:1',
                "bip32:2147483646'",
              ],
              string: "bip32:0/bip32:2147483647'/bip32:1/bip32:2147483646'",
            },
            theirs: "m/0/2147483647'/1/2147483646'",
          },
          extPubKey:
            'xpub6ERApfZwUNrhLCkDtcHTcxd75RbzS1ed54G1LkBUHQVHQKqhMkhgbmJbZRkrgZw4koxb5JaHWkY4ALHY2grBGRjaDMzQLcgJvLJuZZvRcEL',
          extPrivKey:
            'xprvA1RpRA33e1JQ7ifknakTFpgNXPmW2YvmhqLQYMmrj4xJXXWYpDPS3xz7iAxn8L39njGVyuoseXzU6rcxFLJ8HFsTjSyQbLYnMpCqE2VbFWc',
        },
        {
          path: {
            ours: {
              tuple: [
                'bip32:0',
                "bip32:2147483647'",
                'bip32:1',
                "bip32:2147483646'",
                'bip32:2',
              ],
              string:
                "bip32:0/bip32:2147483647'/bip32:1/bip32:2147483646'/bip32:2",
            },
            theirs: "m/0/2147483647'/1/2147483646'/2",
          },
          extPubKey:
            'xpub6FnCn6nSzZAw5Tw7cgR9bi15UV96gLZhjDstkXXxvCLsUXBGXPdSnLFbdpq8p9HmGsApME5hQTZ3emM2rnY5agb9rXpVGyy3bdW6EEgAtqt',
          extPrivKey:
            'xprvA2nrNbFZABcdryreWet9Ea4LvTJcGsqrMzxHx98MMrotbir7yrKCEXw7nadnHM8Dq38EGfSh6dqA9QWTyefMLEcBYJUuekgW4BYPJcr9E7j',
        },
      ],
    },

    // ===Test vector 3===
    // These vectors test for the retention of leading zeros. For more information, see: https://github.com/bitpay/bitcore-lib/issues/47 and https://github.com/iancoleman/bip39/issues/58
    {
      hexSeed:
        '4b381541583be4423346c643850da4b320e46a87ae3d2a4e6da11eba819cd4acba45d239319ac14f863b8d5ab5a0d0c64d2e8a1e7d1457df2e5a3c51c73235be',
      keys: [
        {
          path: {
            ours: {
              tuple: [],
              string: '',
            },
            theirs: 'm',
          },
          extPubKey:
            'xpub661MyMwAqRbcEZVB4dScxMAdx6d4nFc9nvyvH3v4gJL378CSRZiYmhRoP7mBy6gSPSCYk6SzXPTf3ND1cZAceL7SfJ1Z3GC8vBgp2epUt13',
          extPrivKey:
            'xprv9s21ZrQH143K25QhxbucbDDuQ4naNntJRi4KUfWT7xo4EKsHt2QJDu7KXp1A3u7Bi1j8ph3EGsZ9Xvz9dGuVrtHHs7pXeTzjuxBrCmmhgC6',
        },
        {
          path: {
            ours: {
              tuple: ["bip32:0'"],
              string: "bip32:0'",
            },
            theirs: "m/0'",
          },
          extPubKey:
            'xpub68NZiKmJWnxxS6aaHmn81bvJeTESw724CRDs6HbuccFQN9Ku14VQrADWgqbhhTHBaohPX4CjNLf9fq9MYo6oDaPPLPxSb7gwQN3ih19Zm4Y',
          extPrivKey:
            'xprv9uPDJpEQgRQfDcW7BkF7eTya6RPxXeJCqCJGHuCJ4GiRVLzkTXBAJMu2qaMWPrS7AANYqdq6vcBcBUdJCVVFceUvJFjaPdGZ2y9WACViL4L',
        },
      ],
    },

    // ===Test vector 4===
    // These vectors test for the retention of leading zeros. For more information, see: https://github.com/btcsuite/btcutil/issues/172 btcsuite/btcutil#172
    {
      hexSeed:
        '3ddd5602285899a946114506157c7997e5444528f3003f6134712147db19b678',
      keys: [
        {
          path: {
            ours: {
              tuple: [],
              string: '',
            },
            theirs: 'm',
          },
          extPubKey:
            'xpub661MyMwAqRbcGczjuMoRm6dXaLDEhW1u34gKenbeYqAix21mdUKJyuyu5F1rzYGVxyL6tmgBUAEPrEz92mBXjByMRiJdba9wpnN37RLLAXa',
          extPrivKey:
            'xprv9s21ZrQH143K48vGoLGRPxgo2JNkJ3J3fqkirQC2zVdk5Dgd5w14S7fRDyHH4dWNHUgkvsvNDCkvAwcSHNAQwhwgNMgZhLtQC63zxwhQmRv',
        },
        {
          path: {
            ours: {
              tuple: ["bip32:0'"],
              string: "bip32:0'",
            },
            theirs: "m/0'",
          },
          extPubKey:
            'xpub69AUMk3qDBi3uW1sXgjCmVjJ2G6WQoYSnNHyzkmdCHEhSZ4tBok37xfFEqHd2AddP56Tqp4o56AePAgCjYdvpW2PU2jbUPFKsav5ut6Ch1m',
          extPrivKey:
            'xprv9vB7xEWwNp9kh1wQRfCCQMnZUEG21LpbR9NPCNN1dwhiZkjjeGRnaALmPXCX7SgjFTiCTT6bXes17boXtjq3xLpcDjzEuGLQBM5ohqkao9G',
        },
        {
          path: {
            ours: {
              tuple: ["bip32:0'", "bip32:1'"],
              string: "bip32:0'/bip32:1'",
            },
            theirs: "m/0'/1'",
          },
          extPubKey:
            'xpub6BJA1jSqiukeaesWfxe6sNK9CCGaujFFSJLomWHprUL9DePQ4JDkM5d88n49sMGJxrhpjazuXYWdMf17C9T5XnxkopaeS7jGk1GyyVziaMt',
          extPrivKey:
            'xprv9xJocDuwtYCMNAo3Zw76WENQeAS6WGXQ55RCy7tDJ8oALr4FWkuVoHJeHVAcAqiZLE7Je3vZJHxspZdFHfnBEjHqU5hG1Jaj32dVoS6XLT1',
        },
      ],
    },
  ],
} as const;
