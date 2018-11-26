import { Transaction } from './TransactionController';
import { MessageParams } from './PersonalMessageManager';
const { addHexPrefix, BN, isValidAddress, stripHexPrefix, bufferToHex } = require('ethereumjs-util');
const hexRe = /^[0-9A-Fa-f]+$/g;

const NORMALIZERS: { [param in keyof Transaction]: any } = {
	data: (data: string) => addHexPrefix(data),
	from: (from: string) => addHexPrefix(from).toLowerCase(),
	gas: (gas: string) => addHexPrefix(gas),
	gasPrice: (gasPrice: string) => addHexPrefix(gasPrice),
	nonce: (nonce: string) => addHexPrefix(nonce),
	to: (to: string) => addHexPrefix(to).toLowerCase(),
	value: (value: string) => addHexPrefix(value)
};

/**
 * Converts a BN object to a hex string with a '0x' prefix
 *
 * @param inputBn - BN instance to convert to a hex string
 * @returns - '0x'-prefixed hex string
 *
 */
export function BNToHex(inputBn: any) {
	return addHexPrefix(inputBn.toString(16));
}

/**
 * Used to multiply a BN by a fraction
 *
 * @param targetBN - Number to multiply by a fraction
 * @param numerator - Numerator of the fraction multiplier
 * @param denominator - Denominator of the fraction multiplier
 * @returns - Product of the multiplication
 */
export function fractionBN(targetBN: any, numerator: number | string, denominator: number | string) {
	const numBN = new BN(numerator);
	const denomBN = new BN(denominator);
	return targetBN.mul(numBN).div(denomBN);
}

/**
 * Return a URL that can be used to obtain ETH for a given network
 *
 * @param networkCode - Network code of desired network
 * @param address - Address to deposit obtained ETH
 * @param amount - How much ETH is desired
 * @returns - URL to buy ETH based on network
 */
export function getBuyURL(networkCode = '1', address?: string, amount = 5) {
	switch (networkCode) {
		case '1':
			/* tslint:disable-next-line:max-line-length */
			return `https://buy.coinbase.com/?code=9ec56d01-7e81-5017-930c-513daa27bb6a&amount=${amount}&address=${address}&crypto_currency=ETH`;
		case '3':
			return 'https://faucet.metamask.io/';
		case '4':
			return 'https://www.rinkeby.io/';
		case '42':
			return 'https://github.com/kovan-testnet/faucet';
	}
}

/**
 * Converts a hex string to a BN object
 *
 * @param inputHex - Number represented as a hex string
 * @returns - A BN instance
 *
 */
export function hexToBN(inputHex: string) {
	return new BN(stripHexPrefix(inputHex), 16);
}

/**
 * A helper function that converts hex data to human readable string
 *
 * @param hex - The hex string to convert to string
 * @returns - A human readable string conversion
 *
 */
export function hexToText(hex: string) {
	try {
		const stripped = stripHexPrefix(hex);
		const buff = Buffer.from(stripped, 'hex');
		return buff.toString('utf8');
	} catch (e) {
		/* istanbul ignore next */
		return hex;
	}
}

/**
 * Normalizes properties on a Transaction object
 *
 * @param transaction - Transaction object to normalize
 * @returns - Normalized Transaction object
 */
export function normalizeTransaction(transaction: Transaction) {
	const normalizedTransaction: Transaction = { from: '' };
	let key: keyof Transaction;
	for (key in NORMALIZERS) {
		if (transaction[key as keyof Transaction]) {
			normalizedTransaction[key] = NORMALIZERS[key](transaction[key]);
		}
	}
	return normalizedTransaction;
}

/**
 * Execute and return an asynchronous operation without throwing errors
 *
 * @param operation - Function returning a Promise
 * @returns - Promise resolving to the result of the async operation
 */
export async function safelyExecute(operation: () => Promise<any>) {
	try {
		return await operation();
	} catch (error) {
		/* tslint:disable-next-line:no-empty */
	}
}

/**
 * Validates a Transaction object for required properties and throws in
 * the event of any validation error.
 *
 * @param transaction - Transaction object to validate
 */
export function validateTransaction(transaction: Transaction) {
	if (!transaction.from || typeof transaction.from !== 'string' || !isValidAddress(transaction.from)) {
		throw new Error(`Invalid "from" address: ${transaction.from} must be a valid string.`);
	}
	if (transaction.to === '0x' || transaction.to === undefined) {
		if (transaction.data) {
			delete transaction.to;
		} else {
			throw new Error(`Invalid "to" address: ${transaction.to} must be a valid string.`);
		}
	} else if (transaction.to !== undefined && !isValidAddress(transaction.to)) {
		throw new Error(`Invalid "to" address: ${transaction.to} must be a valid string.`);
	}
	if (transaction.value !== undefined) {
		const value = transaction.value.toString();
		if (value.includes('-')) {
			throw new Error(`Invalid "value": ${value} is not a positive number.`);
		}
		if (value.includes('.')) {
			throw new Error(`Invalid "value": ${value} number must be denominated in wei.`);
		}
	}
}

/**
 * A helper function that converts rawmessageData buffer data to a hex, or just returns the data if
 * it is already formatted as a hex.
 *
 * @param data - The buffer data to convert to a hex
 * @returns - A hex string conversion of the buffer data
 *
 */
export function normalizeMessageData(data: string) {
	try {
		const stripped = stripHexPrefix(data);
		if (stripped.match(hexRe)) {
			return addHexPrefix(stripped);
		}
	} catch (e) {
		/* istanbul ignore next */
	}
	return bufferToHex(Buffer.from(data, 'utf8'));
}

/**
 * Validates a MessageParams object for required properties and throws in
 * the event of any validation error.
 *
 * @param messageData - MessageParams object to validate
 */
export function validatePersonalSignMessageData(messageData: MessageParams) {
	if (!messageData.from || typeof messageData.from !== 'string' || !isValidAddress(messageData.from)) {
		throw new Error(`Invalid "from" address: ${messageData.from} must be a valid string.`);
	}
	if (!messageData.data || typeof messageData.data !== 'string') {
		throw new Error(`Invalid message "data": ${messageData.data} must be a valid string.`);
	}
}

/**
 * Modifies collectible images URI in case is necessary
 *
 * @param address - Collectible address
 * @param image - Initial image URI given by collectible tokenURI
 * @returns - Modified image URI
 */
export function manageCollectibleImage(address: string, image: string) {
	const GODSADDRESS = '0x6EbeAf8e8E946F0716E6533A6f2cefc83f60e8Ab';
	let collectibleImage;
	if (address === GODSADDRESS) {
		collectibleImage = image.split('?')[0];
	} else {
		collectibleImage = image;
	}
	return collectibleImage;
}

export default {
	BNToHex,
	fractionBN,
	getBuyURL,
	hexToBN,
	hexToText,
	manageCollectibleImage,
	normalizeTransaction,
	safelyExecute,
	validateTransaction
};
