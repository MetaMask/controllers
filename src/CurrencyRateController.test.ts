import { stub } from 'sinon';
import CurrencyRateController from './CurrencyRateController';

describe('CurrencyRateController', () => {
	it('should set default state', () => {
		const controller = new CurrencyRateController();
		expect(controller.state).toEqual({
			conversionDate: 0,
			conversionRate: 0,
			currentCurrency: 'usd'
		});
	});

	it('should set default config', () => {
		const controller = new CurrencyRateController();
		expect(controller.config).toEqual({
			currency: 'usd',
			interval: 180000
		});
	});

	it('should poll on correct interval', () => {
		const mock = stub(global, 'setInterval');
		/* tslint:disable-next-line:no-unused-expression */
		new CurrencyRateController(undefined, { interval: 1337 });
		expect(mock.getCall(0).args[1]).toBe(1337);
		mock.restore();
	});

	it('should update rate on interval', () => {
		return new Promise((resolve) => {
			const controller = new CurrencyRateController(undefined, { interval: 10 });
			const mock = stub(controller, 'updateExchangeRate');
			setTimeout(() => {
				expect(mock.called).toBe(true);
				mock.restore();
				resolve();
			}, 20);
		});
	});

	it('should update currency', async () => {
		const controller = new CurrencyRateController(undefined, { interval: 10 });
		expect(controller.state.conversionRate).toEqual(0);
		await controller.updateCurrency('eur');
		expect(controller.state.conversionRate).toBeGreaterThan(0);
	});

	it('should not update rates if disabled', async () => {
		const controller = new CurrencyRateController(undefined, {
			disabled: true,
			interval: 10
		});
		controller.fetchExchangeRate = stub();
		await controller.updateExchangeRate();
		expect((controller.fetchExchangeRate as any).called).toBe(false);
	});

	it('should clear previous interval', () => {
		const mock = stub(global, 'clearInterval');
		const controller = new CurrencyRateController(undefined, { interval: 1337 });
		controller.interval = 1338;
		expect(mock.called).toBe(true);
		mock.restore();
	});
});
