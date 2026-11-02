import type { AccountTreeControllerState } from '@metamask/account-tree-controller';
import { describe, expect, it } from 'vitest';

import type { AssetsControllerState } from '../AssetsController.js';
import type { AccountId } from '../types.js';
import {
  getAccountGroupLoadingStatus,
  getAccountGroupRefreshingStatus,
  getAccountLoadingStatus,
  getAccountRefreshingStatus,
  getIsAssetsLoadingForSelectedAccountGroup,
  getIsAssetsRefreshingForSelectedAccountGroup,
  isAccountGroupLoading,
  isAccountGroupRefreshing,
  isAccountLoading,
  isAccountRefreshing,
} from './loading.js';

const ACCOUNT_ID_A = 'mock-account-id-a' as AccountId;
const ACCOUNT_ID_B = 'mock-account-id-b' as AccountId;
const ACCOUNT_ID_C = 'mock-account-id-c' as AccountId;
const GROUP_ID_1 = 'mock-group-id-1';
const GROUP_ID_2 = 'mock-group-id-2';

const createState = (
  assetsLoadingStatus: Record<AccountId, 'loading' | 'loaded'>,
): Pick<AssetsControllerState, 'assetsLoadingStatus'> => ({
  assetsLoadingStatus,
});

const createAccountTreeState = (
  selectedAccountGroup: string,
): AccountTreeControllerState =>
  ({
    accountTree: {
      wallets: {
        'mock-wallet-id': {
          groups: {
            [GROUP_ID_1]: { accounts: [ACCOUNT_ID_A, ACCOUNT_ID_B] },
            [GROUP_ID_2]: { accounts: [ACCOUNT_ID_C] },
          },
        },
      },
    },
    selectedAccountGroup,
  }) as unknown as AccountTreeControllerState;

describe('getAccountLoadingStatus', () => {
  it('returns the loading status for an account', () => {
    const state = createState({
      [ACCOUNT_ID_A]: 'loading',
      [ACCOUNT_ID_B]: 'loaded',
    });
    expect(getAccountLoadingStatus(state, ACCOUNT_ID_A)).toBe('loading');
    expect(getAccountLoadingStatus(state, ACCOUNT_ID_B)).toBe('loaded');
  });

  it('returns undefined for an account with no loading status', () => {
    expect(
      getAccountLoadingStatus(createState({}), ACCOUNT_ID_C),
    ).toBeUndefined();
  });
});

describe('isAccountLoading', () => {
  it('returns true while an account is loading', () => {
    expect(
      isAccountLoading(
        createState({ [ACCOUNT_ID_A]: 'loading' }),
        ACCOUNT_ID_A,
      ),
    ).toBe(true);
  });

  it('returns false once the account is loaded or has no status', () => {
    expect(
      isAccountLoading(createState({ [ACCOUNT_ID_A]: 'loaded' }), ACCOUNT_ID_A),
    ).toBe(false);
    expect(isAccountLoading(createState({}), ACCOUNT_ID_A)).toBe(false);
  });
});

describe('getAccountGroupLoadingStatus', () => {
  it('returns statuses for the accounts in the group', () => {
    const state = createState({
      [ACCOUNT_ID_A]: 'loading',
      [ACCOUNT_ID_B]: 'loaded',
    });
    expect(
      getAccountGroupLoadingStatus(
        state,
        createAccountTreeState(GROUP_ID_1),
        GROUP_ID_1,
      ),
    ).toStrictEqual({
      [ACCOUNT_ID_A]: 'loading',
      [ACCOUNT_ID_B]: 'loaded',
    });
  });

  it('omits accounts in the group that have no loading status', () => {
    const state = createState({ [ACCOUNT_ID_A]: 'loading' });
    expect(
      getAccountGroupLoadingStatus(
        state,
        createAccountTreeState(GROUP_ID_1),
        GROUP_ID_1,
      ),
    ).toStrictEqual({ [ACCOUNT_ID_A]: 'loading' });
  });

  it('returns an empty object for an unknown group', () => {
    const state = createState({ [ACCOUNT_ID_A]: 'loading' });
    expect(
      getAccountGroupLoadingStatus(state, createAccountTreeState(''), 'nope'),
    ).toStrictEqual({});
  });
});

describe('isAccountGroupLoading', () => {
  it('returns true while any account in the group is loading', () => {
    const state = createState({
      [ACCOUNT_ID_A]: 'loaded',
      [ACCOUNT_ID_B]: 'loading',
    });
    expect(
      isAccountGroupLoading(
        state,
        createAccountTreeState(GROUP_ID_1),
        GROUP_ID_1,
      ),
    ).toBe(true);
  });

  it('returns false when no account in the group is loading', () => {
    const state = createState({
      [ACCOUNT_ID_A]: 'loaded',
      [ACCOUNT_ID_B]: 'loaded',
      [ACCOUNT_ID_C]: 'loading',
    });
    expect(
      isAccountGroupLoading(
        state,
        createAccountTreeState(GROUP_ID_1),
        GROUP_ID_1,
      ),
    ).toBe(false);
  });
});

describe('getIsAssetsLoadingForSelectedAccountGroup', () => {
  it('returns true while any account in the selected group is loading', () => {
    const state = createState({ [ACCOUNT_ID_C]: 'loading' });
    expect(
      getIsAssetsLoadingForSelectedAccountGroup(
        state,
        createAccountTreeState(GROUP_ID_2),
      ),
    ).toBe(true);
  });

  it('returns false when the selected group is not loading', () => {
    const state = createState({
      [ACCOUNT_ID_A]: 'loaded',
      [ACCOUNT_ID_B]: 'loading',
    });
    expect(
      getIsAssetsLoadingForSelectedAccountGroup(
        state,
        createAccountTreeState(GROUP_ID_2),
      ),
    ).toBe(false);
  });

  it('returns false when no group is selected', () => {
    const state = createState({ [ACCOUNT_ID_A]: 'loading' });
    expect(
      getIsAssetsLoadingForSelectedAccountGroup(
        state,
        createAccountTreeState(''),
      ),
    ).toBe(false);
  });
});

const createRefreshingState = (
  assetsRefreshingStatus: Record<AccountId, 'refreshing' | 'idle'>,
): Pick<AssetsControllerState, 'assetsRefreshingStatus'> => ({
  assetsRefreshingStatus,
});

describe('getAccountRefreshingStatus', () => {
  it('returns the refresh status for an account', () => {
    const state = createRefreshingState({
      [ACCOUNT_ID_A]: 'refreshing',
      [ACCOUNT_ID_B]: 'idle',
    });
    expect(getAccountRefreshingStatus(state, ACCOUNT_ID_A)).toBe('refreshing');
    expect(getAccountRefreshingStatus(state, ACCOUNT_ID_B)).toBe('idle');
  });

  it('returns undefined for an account with no refresh status', () => {
    expect(
      getAccountRefreshingStatus(createRefreshingState({}), ACCOUNT_ID_C),
    ).toBeUndefined();
  });
});

describe('isAccountRefreshing', () => {
  it('returns true while an account is refreshing', () => {
    expect(
      isAccountRefreshing(
        createRefreshingState({ [ACCOUNT_ID_A]: 'refreshing' }),
        ACCOUNT_ID_A,
      ),
    ).toBe(true);
  });

  it('returns false once the account is idle or has no status', () => {
    expect(
      isAccountRefreshing(
        createRefreshingState({ [ACCOUNT_ID_A]: 'idle' }),
        ACCOUNT_ID_A,
      ),
    ).toBe(false);
    expect(isAccountRefreshing(createRefreshingState({}), ACCOUNT_ID_A)).toBe(
      false,
    );
  });
});

describe('getAccountGroupRefreshingStatus', () => {
  it('returns statuses for the accounts in the group', () => {
    const state = createRefreshingState({
      [ACCOUNT_ID_A]: 'refreshing',
      [ACCOUNT_ID_B]: 'idle',
    });
    expect(
      getAccountGroupRefreshingStatus(
        state,
        createAccountTreeState(GROUP_ID_1),
        GROUP_ID_1,
      ),
    ).toStrictEqual({
      [ACCOUNT_ID_A]: 'refreshing',
      [ACCOUNT_ID_B]: 'idle',
    });
  });
});

describe('isAccountGroupRefreshing', () => {
  it('returns true while any account in the group is refreshing', () => {
    const state = createRefreshingState({
      [ACCOUNT_ID_A]: 'idle',
      [ACCOUNT_ID_B]: 'refreshing',
    });
    expect(
      isAccountGroupRefreshing(
        state,
        createAccountTreeState(GROUP_ID_1),
        GROUP_ID_1,
      ),
    ).toBe(true);
  });

  it('returns false when no account in the group is refreshing', () => {
    const state = createRefreshingState({
      [ACCOUNT_ID_A]: 'idle',
      [ACCOUNT_ID_C]: 'refreshing',
    });
    expect(
      isAccountGroupRefreshing(
        state,
        createAccountTreeState(GROUP_ID_1),
        GROUP_ID_1,
      ),
    ).toBe(false);
  });
});

describe('getIsAssetsRefreshingForSelectedAccountGroup', () => {
  it('returns true while any account in the selected group is refreshing', () => {
    const state = createRefreshingState({ [ACCOUNT_ID_C]: 'refreshing' });
    expect(
      getIsAssetsRefreshingForSelectedAccountGroup(
        state,
        createAccountTreeState(GROUP_ID_2),
      ),
    ).toBe(true);
  });

  it('returns false when the selected group is not refreshing', () => {
    const state = createRefreshingState({
      [ACCOUNT_ID_A]: 'idle',
      [ACCOUNT_ID_B]: 'refreshing',
    });
    expect(
      getIsAssetsRefreshingForSelectedAccountGroup(
        state,
        createAccountTreeState(GROUP_ID_2),
      ),
    ).toBe(false);
  });

  it('returns false when no group is selected', () => {
    const state = createRefreshingState({ [ACCOUNT_ID_A]: 'refreshing' });
    expect(
      getIsAssetsRefreshingForSelectedAccountGroup(
        state,
        createAccountTreeState(''),
      ),
    ).toBe(false);
  });
});
