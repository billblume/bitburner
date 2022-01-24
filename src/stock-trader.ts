import { NS } from '@ns';

const TICK_TIME = 6000;
const PRICE_HISTORY_LEN = 11;
const BUDGET_RATIO = 0.5;
const HISTORY_BUY_RATIO = 0.8;
const HISTORY_SELL_RATIO = 0.6;
const FORECAST_BUY_RATIO = 0.6;
const FORECAST_SELL_RATIO = 0.5;
const COMMISSION_FEE = 100000;
const MIN_STOCK_BUDGET = COMMISSION_FEE * 50;

export async function main(ns: NS): Promise<void> {
    const trader = new StockTrader(ns);
    await trader.run();
}

class StockTrader {
    ns: NS;
    symbols: string[];
    priceHistory: Record<string, number[]>;
    has4SMarketData: boolean;

    constructor(ns: NS) {
        this.ns = ns;
        ns.disableLog('ALL');
        ns.enableLog('print');
        this.symbols = ns.stock.getSymbols();
        this.priceHistory = {};

        for (const sym of this.symbols) {
            this.priceHistory[sym] = [];
        }

        this.has4SMarketData = ns.stock.purchase4SMarketData()
            && ns.stock.purchase4SMarketDataTixApi();
    }

    async run(): Promise<void> {
        if (!this.has4SMarketData) {
            this.ns.print('INFO Populating price history');

            for (let i = 0; i < PRICE_HISTORY_LEN; ++i) {
                this.updatePriceHistory();
                await this.ns.sleep(TICK_TIME);
            }
        }

        while (true) {
            if (!this.has4SMarketData) {
                this.updatePriceHistory();
            }

            this.sellStocks();
            this.buyStocks();
            await this.ns.sleep(TICK_TIME);
        }
    }

    updatePriceHistory(): void {
        for (const sym of this.symbols) {
            const price = this.ns.stock.getPrice(sym);

            if (this.priceHistory[sym].length > PRICE_HISTORY_LEN) {
                this.priceHistory[sym].shift();
            }

            this.priceHistory[sym].push(price);
        }
    }

    readPositions(): Record<string,[number, number, number, number]> {
        const positions: Record<string,[number, number, number, number]> = {};

        for (const sym of this.symbols) {
            positions[sym] = this.ns.stock.getPosition(sym);
        }

        return positions;
    }

    sellStocks(): void {
        const positions = this.readPositions();

        for (const sym in positions) {
            const position = positions[sym];
            const shares = position[0];

            if (shares > 0) {
                const action = this.getStockAction(sym);

                if (action == 'sell') {
                    const price = this.ns.stock.getSaleGain(sym, shares, 'Long');
                    this.ns.print(this.ns.sprintf(
                        'Selling %d shares of %s for %s',
                        shares,
                        sym,
                        this.ns.nFormat(price, '$0.000a'),
                    ));
                    this.ns.stock.sell(sym, shares);
                }
            }
        }
    }

    buyStocks(): void {
        const positions = this.readPositions();
        const budget = this.computeBudget(positions);

        if (budget <= 0) {
            return;
        }

        const buySyms = this.symbols.filter(sym => this.getStockAction(sym) == 'buy');

        if (buySyms.length == 0) {
            return;
        }

        const stockBudget = budget / buySyms.length;

        if (stockBudget < MIN_STOCK_BUDGET) {
            return;
        }

        for (const sym of buySyms) {
            const position = positions[sym];
            const remainingShares = this.ns.stock.getMaxShares(sym) - position[0];
            const price = this.ns.stock.getPrice(sym);
            const shares = Math.min(Math.floor(stockBudget / price), remainingShares);

            if (shares > 0) {
                const cost = this.ns.stock.getPurchaseCost(sym, shares, 'Long');
                this.ns.print(this.ns.sprintf(
                    'Buying %d shares of %s for %s',
                    shares,
                    sym,
                    this.ns.nFormat(cost, '$0.000a'),
                ));
                this.ns.stock.buy(sym, shares);
            }
        }
    }

    computeBudget(positions: Record<string,[number, number, number, number]>): number {
        const avail = this.ns.getServerMoneyAvailable('home');
        let cost = 0;
        let gains = 0;

        for (const sym in positions) {
            const position = positions[sym];
            const shares = position[0];
            const avgPx = position[1];
            cost += shares * avgPx;
            gains += (this.ns.stock.getBidPrice(sym) - avgPx) * shares;
        }

        let budget = (avail + cost) * BUDGET_RATIO;
        budget = Math.max(budget - cost, 0);
        this.ns.print(this.ns.sprintf(
            'INFO budget %s (Avail: %s, Cost: %s, Gains: %s %.02f%%)',
            this.ns.nFormat(budget, '$0.000a'),
            this.ns.nFormat(avail, '$0.000a'),
            this.ns.nFormat(cost, '$0.000a'),
            this.ns.nFormat(gains, '$0.000a'),
            cost > 0 ? 100 * gains / cost : 0
        ));
        return budget;
    }

    getStockAction(sym: string): string {
        if (this.has4SMarketData) {
            return this.get4SStockAction(sym);
        } else {
            return this.getPriceHistoryStockAction(sym);
        }
    }

    getPriceHistoryStockAction(sym: string): string {
        let numPriceIncreases = 0;
        let numPriceDecreases = 0;

        for (let i = 1; i < PRICE_HISTORY_LEN; ++i) {
            const currPrice = this.priceHistory[sym][i];
            const prevPrice = this.priceHistory[sym][i - 1];

            if (currPrice > prevPrice) {
                ++numPriceIncreases;
            } else if (currPrice < prevPrice) {
                ++numPriceDecreases;
            }
        }

        let action = 'hold';

        if (numPriceIncreases >= (PRICE_HISTORY_LEN - 1) * HISTORY_BUY_RATIO) {
            action = 'buy';
        } else if (numPriceDecreases >= (PRICE_HISTORY_LEN - 1) * HISTORY_SELL_RATIO) {
            action = 'sell';
        }

        return action;
    }

    get4SStockAction(sym: string): string {
        const forecast = this.ns.stock.getForecast(sym);
        let action = 'hold';

        if (forecast >= FORECAST_BUY_RATIO) {
            action = 'buy';
        } else if (forecast <= FORECAST_SELL_RATIO) {
            action = 'sell';
        }

        return action;
    }
}
