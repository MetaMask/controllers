import { Mutex } from 'async-mutex';
import type { Patch } from 'immer';

import { BaseController } from '../BaseControllerV2';
import { safelyExecute } from '../util';
import { fetchGasEstimates as defaultFetchGasEstimates } from './gas-util';

import type { RestrictedControllerMessenger } from '../ControllerMessenger';

/**
 * @type LegacyGasFee
 *
 * Data necessary to provide an estimated legacy gas price
 *
 * @property gasPrice - A representation of a single `gasPrice`, for legacy transactions. A GWEI hex number
 */

interface LegacyGasFee {
  gasPrice: string, // a GWEI hex number
}

/**
 * @type Eip1559GasFee
 *
 * Data necessary to provide an estimate of a gas fee with a specific tip
 *
 * @property minWaitTimeEstimate - The fastest the transaction will take, in milliseconds
 * @property maxWaitTimeEstimate - The slowest the transaction will take, in milliseconds
 * @property suggestedMaxPriorityFeePerGas - A suggested "tip", a GWEI hex number
 * @property suggestedMaxFeePerGas - A suggested max fee, the most a user will pay. a GWEI hex number
 * @property calculatedTotalMinFee - suggestedMaxPriorityFeePerGas + estimatedNextBlockBaseFee
 */

 /**
  * @type LegacyGasPriceEstimates
  *
  * Data necessary to provide multiple GasFee estimates, and supporting information, to the user
  *
  * @property low - A LegacyGasFee for a minimum necessary gas price
  * @property medium - A LegacyGasFee for a recommended gas price
  * @property high - A GasLegacyGasFeeFee for a high gas price
  */

interface LegacyGasPriceEstimates {
 low: LegacyGasFee,
 medium: LegacyGasFee,
 high: LegacyGasFee,
}

interface Eip1559GasFee {
  minWaitTimeEstimate: number, // a time duration in milliseconds
  maxWaitTimeEstimate: number, // a time duration in milliseconds
  suggestedMaxPriorityFeePerGas: string, // a GWEI hex number
  suggestedMaxFeePerGas: string, // a GWEI hex number
  calculatedTotalMinFee: string, // a GWEI hex number
}

/**
 * @type GasFeeEstimates
 *
 * Data necessary to provide multiple GasFee estimates, and supporting information, to the user
 *
 * @property low - A GasFee for a minimum necessary combination of tip and maxFee
 * @property medium - A GasFee for a recommended combination of tip and maxFee
 * @property high - A GasFee for a high combination of tip and maxFee
 * @property estimatedNextBlockBaseFee - An estimate of what the base fee will be for the pending/next block. A GWEI hex number
 * @property lastBlockBaseFee - The base fee for the most recent block. A GWEI hex number
 * @property lastBlockMinPriorityFee - The lowest tip that succeeded in the most recent block. A GWEI hex number
 * @property lastBlockMaxPriorityFee - The highest tip that succeeded in the most recent block. A GWEI hex number
 */

 interface GasFeeEstimates {
  low: Eip1559GasFee,
  medium: Eip1559GasFee,
  high: Eip1559GasFee,
  estimatedNextBlockBaseFee: string,
  lastBlockBaseFee: string,
  lastBlockMinPriorityFee: string,
  lastBlockMaxPriorityFee: string,
 }


/**
 * @type GasFeeState
 *
 * Gas Fee controller state
 *
 * @property legacyGasPriceEstimates - Gas fee estimate data using the legacy `gasPrice` property
 * @property gasFeeEstimates - Gas fee estimate data based on new EIP-1559 properties
 */
export interface GasFeeState extends BaseState {
  legacyGasPriceEstimates: LegacyGasPriceEstimates | undefined;
  gasFeeEstimates: GasFeeEstimates | undefined;
}

const name = 'GasFeeController';

export type GasFeeStateChange = {
  type: `${typeof name}:stateChange`;
  payload: [GasFeeState, Patch[]];
};

export type GetGasFeeState = {
  type: `${typeof name}:getState`;
  handler: () => GasFeeState;
};

const defaultState = {
  legacyGasPriceEstimates: undefined,
  gasFeeEstimates: undefined,
};

/**
 * Controller that retrieves gas fee estimate data and polls for updated data on a set interval
 */
export class GasFeeController extends BaseController<
  typeof name,
  GasFeeState
> {
  private mutex = new Mutex();

  private intervalId?: NodeJS.Timeout;

  private intervalDelay;

  private getChainEIP1559Compatibility;

  private getAccountEIP1559Compatibility;

  private pollCount: number = 0;

  /**
   * Creates a GasFeeController instance
   *
   */
  constructor({
    interval = 15000,
    messenger,
    state,
    fetchGasEstimates = defaultFetchGasEstimates,
  }: {
    interval?: number;
    messenger: RestrictedControllerMessenger<
      typeof name,
      GetGasFeeState,
      GasFeeStateChange,
      never,
      never
    >;
    state?: Partial<GasFeeState>;
    fetchGasEstimates?: typeof defaultFetchGasEstimates;
    getChainEIP1559Compatibility?: Function;
    getAccountEIP1559Compatibility?: Function;
  }) {
    super({
      name,
      messenger,
      state: { ...defaultState, ...state },
    });
    this.intervalDelay = interval;
  }

  async getGasFeeEstimatesAndStartPolling(): Promise<GasFeeState | undefined> {
    let gasEstimates
    if (this.pollCount > 0) {
      gasEstimates = this.state
    } else {
      gasEstimates = await this._fetchGasFeeEstimateData()
    }

    this._startPolling()

    return gasEstimates
  }

  /**
   * Gets and sets gasFeeEstimates in state
   *
   * @returns GasFeeEstimates
   */
  async _fetchGasFeeEstimateData(): Promise<GasFeeState | undefined> {
    let newEstimates: GasFeeState;
    try {
      const estimates = await this.fetchGasEstimates();
      newEstimates = {
        legacyGasPriceEstimates: {
          low: {
            gasPrice: estimates.low.suggestedMaxFeePerGas
          },
          medium: {
            gasPrice: estimates.medium.suggestedMaxFeePerGas
          },
          high: {
            gasPrice: estimates.high.suggestedMaxFeePerGas
          }
        },
        gasFeeEstimates: estimates,
      };
    } catch (error) {
      console.error(error);
    } finally {
      try {
        this.update(() => {
          return newEstimates;
        });
      } finally {
        return newEstimates;
      }
    }
  }

  async _startPolling() {
    if (this.pollCount === 0) {
      this._poll();
    }
    this.pollCount += 1;
  }

  async _poll() {
    this.intervalId = setInterval(async () => {
      await safelyExecute(() => this._fetchGasFeeEstimateData());
    }, this.intervalDelay);
  }

  /**
   * Reduce the count of opened transactions for which polling is needed, and stop polling if polling is no longer needed
   */
  disconnectPoller() {
    this.pollCount -= 1;
    if (this.pollCount === 0) {
      this.stopPolling();
    }
  }

  private stopPolling() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.pollCount = 0;
    this.resetState();
  }

  private resetState() {
    this.state = defaultState;
  }

  /**
   * Prepare to discard this controller.
   *
   * This stops any active polling.
   */
  private destroy() {
    super.destroy();
    this.stopPolling();
  }

}

export default GasFeeController;
