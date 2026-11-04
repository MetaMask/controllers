import { isEvmAccountType } from '@metamask/keyring-api';
import { StaticIntervalPollingController } from '@metamask/polling-controller';
import { calculateDeFiPositionMetrics } from './calculate-defi-metrics.js';
import { buildPositionFetcher } from './fetch-positions.js';
import { groupDeFiPositions } from './group-defi-positions.js';
const TEN_MINUTES_IN_MS = 600_000;
const controllerName = 'DeFiPositionsController';
const MESSENGER_EXPOSED_METHODS = [
    'startPolling',
    'stopPollingByPollingToken',
];
const controllerMetadata = {
    allDeFiPositions: {
        includeInStateLogs: false,
        persist: false,
        includeInDebugSnapshot: false,
        usedInUi: true,
    },
    allDeFiPositionsCount: {
        includeInStateLogs: false,
        persist: false,
        includeInDebugSnapshot: false,
        usedInUi: false,
    },
};
export const getDefaultDefiPositionsControllerState = () => {
    return {
        allDeFiPositions: {},
        allDeFiPositionsCount: {},
    };
};
/**
 * Controller that stores assets and exposes convenience methods
 */
export class DeFiPositionsController extends StaticIntervalPollingController() {
    #fetchPositions;
    #isEnabled;
    #trackEvent;
    /**
     * DeFiPositionsController constuctor
     *
     * @param options - Constructor options.
     * @param options.messenger - The controller messenger.
     * @param options.isEnabled - Function that returns whether the controller is enabled. (default: () => true)
     * @param options.trackEvent - Function to track events. (default: undefined)
     */
    constructor({ messenger, isEnabled = () => true, trackEvent, }) {
        super({
            name: controllerName,
            metadata: controllerMetadata,
            messenger,
            state: getDefaultDefiPositionsControllerState(),
        });
        this.setIntervalLength(TEN_MINUTES_IN_MS);
        this.#fetchPositions = buildPositionFetcher();
        this.#isEnabled = isEnabled;
        this.messenger.subscribe('KeyringController:lock', () => {
            this.stopAllPolling();
        });
        this.messenger.subscribe('TransactionController:transactionConfirmed', async (transactionMeta) => {
            const selectedAddress = this.#getSelectedEvmAdress();
            if (selectedAddress?.toLowerCase() !==
                transactionMeta.txParams.from.toLowerCase()) {
                return;
            }
            await this.#updateAccountPositions(selectedAddress);
        });
        this.messenger.subscribe('AccountTreeController:selectedAccountGroupChange', async () => {
            const selectedAddress = this.#getSelectedEvmAdress();
            if (!selectedAddress) {
                return;
            }
            await this.#updateAccountPositions(selectedAddress);
        });
        this.#trackEvent = trackEvent;
        this.messenger.registerMethodActionHandlers(this, MESSENGER_EXPOSED_METHODS);
    }
    async _executePoll() {
        if (!this.#isEnabled()) {
            return;
        }
        const selectedAddress = this.#getSelectedEvmAdress();
        if (!selectedAddress) {
            return;
        }
        const accountPositions = await this.#fetchAccountPositions(selectedAddress);
        this.update((state) => {
            state.allDeFiPositions[selectedAddress] = accountPositions;
        });
    }
    async #updateAccountPositions(accountAddress) {
        if (!this.#isEnabled()) {
            return;
        }
        const accountPositionsPerChain = await this.#fetchAccountPositions(accountAddress);
        this.update((state) => {
            state.allDeFiPositions[accountAddress] = accountPositionsPerChain;
        });
    }
    async #fetchAccountPositions(accountAddress) {
        try {
            const defiPositionsResponse = await this.#fetchPositions(accountAddress);
            const groupedDeFiPositions = groupDeFiPositions(defiPositionsResponse);
            try {
                this.#updatePositionsCountMetrics(groupedDeFiPositions, accountAddress);
            }
            catch (error) {
                console.error(`Failed to update positions count for account ${accountAddress}:`, error);
            }
            return groupedDeFiPositions;
        }
        catch {
            return null;
        }
    }
    #updatePositionsCountMetrics(groupedDeFiPositions, accountAddress) {
        // If no track event passed then skip the metrics update
        if (!this.#trackEvent) {
            return;
        }
        const defiMetrics = calculateDeFiPositionMetrics(groupedDeFiPositions);
        const { totalPositions } = defiMetrics.properties;
        if (totalPositions !== this.state.allDeFiPositionsCount[accountAddress]) {
            this.update((state) => {
                state.allDeFiPositionsCount[accountAddress] = totalPositions;
            });
            this.#trackEvent?.(defiMetrics);
        }
    }
    #getSelectedEvmAdress() {
        return this.messenger
            .call('AccountTreeController:getAccountsFromSelectedAccountGroup')
            .find((account) => isEvmAccountType(account.type))
            ?.address;
    }
}
