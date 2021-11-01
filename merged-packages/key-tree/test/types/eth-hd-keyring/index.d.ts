declare module 'eth-hd-keyring' {
  export default class HdKeyring {
    constructor(args: Record<string, unknown>);

    getAccounts(): Promise<string[]>;
  }
}
