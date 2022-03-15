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
    addresses: [
      '0x1c96099350f13d558464ec79b9be4445aa0ef579',
      '0x1b00aed43a693f3a957f9feb5cc08afa031e37a0',
      '0x8c9ba4f86ae12250ee1c3676ee925c77426d0b68',
      '0xffe45dbc6c1bee8f211da2ec961f73b82e9ab42c',
      '0xb8a13c465c9a0a46f262a1ad666a752923e65b8c',
    ],
  },

  // https://github.com/ethereumjs/ethereumjs-wallet/blob/2bc21b408da3b002a95aa752b94fa039ffc64e0f/test/hdkey.spec.ts
  // The state of the default branch as of 2021-10-19
  'ethereumjs-wallet': {
    hexSeed:
      '747f302d9c916698912d5f70be53a6cf53bc495803a5523d3a7c3afa2afba94ec3803f838b3e1929ab5481f9da35441372283690fdcf27372c38f40ba134fe03',
    privateKey:
      'f29d6ddd6b0cd1fd59ed99900edd5a53e905b87dfe06824751010feb5228d960',
    address: 'b9f89177a4ce589e6d18c33a9748bcc8063836df',
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
    sampleAddressIndices: [
      {
        index: 0,
        address: 'c5ba325f997531b5f0f50868913f0ce2fc0386bd',
      },
      {
        index: 1,
        address: '326aa42f2b600f624d800e109b1e146906bc8175',
      },
      {
        index: 5,
        address: '6d0cc8671c91559d5f2d43de9c33eee0497db7cd',
      },
      {
        index: 50,
        address: '7bf971adda7f4487ac8f3dbd7450463ff3624f94',
      },
      {
        index: 500,
        address: '564d7507d39a881d04bffc0120ebd331e7c41758',
      },
      {
        index: 5000,
        address: '7496ff062c1fe3e750dff9cbbe317558161ba6db',
      },
      {
        index: 4_999_999,
        address: 'ddf1f1a72a668d5014ec57a24019291fd2a00197',
      },
      {
        index: 5_000_000,
        address: '24dd12b9df5375f3b7fc5a539d4ac1bd2c16e9a0',
      },
    ],
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
          privateKey:
            'e8f32e723decf4051aefac8e2c93c9c5b214313817cdb01a1494b917c8436b35',
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
          privateKey:
            'edb2e14f9ee77d26dd93b4ecede8d16ed408ce149b6cd80b0715a2d911a0afea',
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
          privateKey:
            '3c6cb8d0f6a264c91ea8b5030fadaa8e538b020f0a387421a12de9319dc93368',
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
          privateKey:
            'cbce0d719ecf7431d88e6a89fa1483e02e35092af60c042b1df2ff59fa424dca',
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
          privateKey:
            '0f479245fb19a38a1954c5c7c0ebab2f9bdfd96a17563ef28a6a4b1a2a764ef4',
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
          privateKey:
            '471b76e389e528d6de6d816857e012c5455051cad6660850e58372a6c3e6e7c8',
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
          privateKey:
            '4b03d6fc340455b363f51020ad3ecca4f0850280cf436c70c727923f6db46c3e',
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
          privateKey:
            'abe74a98f6c7eabee0428f53798f0ab8aa1bd37873999041703c742f15ac7e1e',
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
          privateKey:
            '877c779ad9687164e9c2f4f0f4ff0340814392330693ce95a58fe18fd52e6e93',
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
          privateKey:
            '704addf544a06e5ee4bea37098463c23613da32020d604506da8c0518e1da4b7',
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
          privateKey:
            'f1c7c871a54a804afe328b4c83a1c33b8e5ff48f5087273f04efa83b247d6a2d',
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
          privateKey:
            'bb7d39bdb83ecf58f2fd82b6d918341cbef428661ef01ab97c28a4842125ac23',
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
          privateKey:
            '00ddb80b067e0d4993197fe10f2657a844a384589847602d56f0c629c81aae32',
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
          privateKey:
            '491f7a2eebc7b57028e0d3faa0acda02e75c33b03c48fb288c41e2ea44e1daef',
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
          privateKey:
            '12c0d59c7aa3a10973dbd3f478b65f2516627e3fe61e00c345be9a477ad2e215',
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
          privateKey:
            '00d948e9261e41362a688b916f297121ba6bfb2274a3575ac0e456551dfd7f7e',
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
          privateKey:
            '3a2086edd7d9df86c3487a5905a1712a9aa664bce8cc268141e07549eaa8661d',
        },
      ],
    },
  ],

  // https://github.com/cryptocoinjs/secp256k1-node/blob/f73cd3a2b95ec6f549a2feabfbf2b8f17b30dcc7/test/privatekey.js
  // The state of the default branch as of 2022-03-10
  // Fixtures generated by running the tests and logging the (pseudo-)randomly generated private key
  // and tweak.
  'secp256k1-node': {
    privateAdd: [
      {
        privateKey:
          '0000000000000000000000000000000000000000000000000000000000000001',
        tweak:
          '0000000000000000000000000000000000000000000000000000000000000001',
        result:
          '0000000000000000000000000000000000000000000000000000000000000002',
      },
      {
        privateKey:
          '8b147e947559e2a1598f6f0c334512a318a17e2f7992110448f33e42b365c2b6',
        tweak:
          'e6a9bdd2ccbccdf4c65472338459df8888cc77fbf4ffcd0b9c35e36a68b24ae9',
        result:
          '71be3c674216b0961fe3e13fb79ef22ce6bf1944bf493dd42556c3204be1cc5e',
      },
      {
        privateKey:
          '28ae78e8c4674af70102b7ed86156e2563e5d53011f3cbd86c302d7a927b4a2d',
        tweak:
          '116f2e9181d755d41ffe6b01f0bf2ddf45ca3300acb8dea7a8b436ebdc166207',
        result:
          '3a1da77a463ea0cb210122ef76d49c04a9b00830beacaa8014e464666e91ac34',
      },
      {
        privateKey:
          'a03f6d00fde0ae947746099de9d8038558879fb074a7bf8912366f377e227d8b',
        tweak:
          'e09c82be0eb3d7e8c1f22387b412b324805e17ffbc42beddfb4e498723a26ac8',
        result:
          '80dbefbf0c94867d39382d259deab6ab1e36dac981a1de2b4db25a31d18ea712',
      },
      {
        privateKey:
          '81f0934c5b1e2ba3d3f929eb8b5a5b0afbb3e1ac73020644327d19464e14453f',
        tweak:
          '7bce175ad49a5824ac09d0ef1ce66099a2a55bcdf89438283f69d86e60144af1',
        result:
          'fdbeaaa72fb883c88002fadaa840bba49e593d7a6b963e6c71e6f1b4ae289030',
      },
      {
        privateKey:
          'fca181aa616897c330c1847dc0e10400016ebef97f43ecf593cd5ef7c4f105b7',
        tweak:
          '33b0309878b3100d4b7652361e0efe72a482a7a5009d3ce7f5fd069db81540a0',
        result:
          '3051b242da1ba7d07c37d6b3def00273eb4289b7d09889a1c9f80708acd00516',
      },
    ],
  },
} as const;
