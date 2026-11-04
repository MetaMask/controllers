import type { Hex } from '@metamask/utils';
import type { DefiPositionResponse, PositionType, ProtocolToken, Underlying } from './fetch-positions.js';
export type GroupedDeFiPositions = {
    aggregatedMarketValue: number;
    protocols: {
        [protocolId: string]: {
            protocolDetails: {
                name: string;
                iconUrl: string;
            };
            aggregatedMarketValue: number;
            positionTypes: {
                [key in PositionType]?: {
                    aggregatedMarketValue: number;
                    positions: ProtocolTokenWithMarketValue[][];
                };
            };
        };
    };
};
export type ProtocolTokenWithMarketValue = Omit<ProtocolToken, 'tokens'> & {
    marketValue?: number;
    tokens: UnderlyingWithMarketValue[];
};
export type UnderlyingWithMarketValue = Omit<Underlying, 'tokens'> & {
    marketValue?: number;
};
/**
 *
 * @param defiPositionsResponse - The response from the defi positions API
 * @returns The grouped positions that get assigned to the state
 */
export declare function groupDeFiPositions(defiPositionsResponse: DefiPositionResponse[]): {
    [key: Hex]: GroupedDeFiPositions;
};
