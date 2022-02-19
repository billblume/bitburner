import { NS } from '@ns'

const PRICE_HISTORY_LEN = 41;
const COMMISSION_FEE = 100000;
const MIN_BUY_AMOUNT = COMMISSION_FEE * 100;

export class Stock {
    ns: NS;
    sym: string;
    has4SData: boolean;
    priceHistory: number[];
    positionType: string;
    shares: number;
    buyPrice: number;
    forecast: number;
    volatility: number;
    buyPositionType: string;
    estProfit: number;
    totalCost: number;
    totalSales: number;
    ticksSinceLastBuy: number;

    constructor(ns: NS, sym: string, has4SData: boolean) {
        this.ns = ns;
        this.sym = sym;
        this.has4SData = has4SData;
        this.priceHistory = [];
        this.positionType = 'None';
        this.shares = 0;
        this.buyPrice = 0;
        this.forecast = 0.5;
        this.volatility = 0;
        this.buyPositionType = 'Hold';
        this.estProfit = 0;
        this.totalCost = 0;
        this.totalSales = 0;
        this.ticksSinceLastBuy = 0;
    }

    update(): void {
        this.updatePosition();
        this.updatePriceHistory();
        this.updateForecast();
    }

    updatePosition(): void {
        const positionInfo = this.ns.stock.getPosition(this.sym);

        if (positionInfo[0] > 0) {
            this.positionType = 'Long';
            this.shares = positionInfo[0];
            this.buyPrice = positionInfo[1];
        } else if (positionInfo[2] > 0) {
            this.positionType = 'Short';
            this.shares = positionInfo[2];
            this.buyPrice = positionInfo[3];
        } else {
            this.positionType = 'None';
            this.shares = 0;
            this.buyPrice = 0;
        }
    }

    updatePriceHistory(): void {
        const price = this.ns.stock.getPrice(this.sym);

        if (this.priceHistory.length > PRICE_HISTORY_LEN) {
            this.priceHistory.shift();
        }

        this.priceHistory.push(price);
        ++this.ticksSinceLastBuy;
    }

    setLastPriceHistoryItem(price: number): void {
        this.priceHistory[this.priceHistory.length - 1] = price;
    }

    updateForecast(): void {
        let errorMargin;

        if (this.has4SData) {
            this.forecast = this.ns.stock.getForecast(this.sym);
            this.volatility = this.ns.stock.getVolatility(this.sym);
            errorMargin = 0.01;
        } else {
            this.volatility = 0;
            let numPriceIncreases = 0;

            for (let i = 1; i < this.priceHistory.length; ++i) {
                const currPrice = this.priceHistory[i];
                const prevPrice = this.priceHistory[i - 1];

                if (currPrice > prevPrice) {
                    ++numPriceIncreases;
                }

               this.volatility = Math.max(this.volatility,
                    currPrice == 0 ? 0 : Math.abs(currPrice - prevPrice) / currPrice);
            }

            this.forecast = numPriceIncreases / (this.priceHistory.length - 1);
            errorMargin = 2 / (this.priceHistory.length - 1);
        }

        if (Math.abs(this.forecast - 0.5) <= errorMargin) {
            this.buyPositionType = 'Hold';
        } else if (this.forecast > 0.5) {
            this.buyPositionType = 'Long';
        } else {
            this.buyPositionType = 'Short';
        }

        /* Uncomment if you don't have BN8.2 unlocked yet
        if (this.buyPositionType == 'Short') {
            this.buyPositionType = 'Hold';
        }
        */

        this.estProfit = Math.abs(this.forecast - 0.5) * this.volatility;
    }

    printForecast(): void {
        this.ns.print(this.ns.sprintf('INFO: %s Forecast: %.2f%%, Volatility: %.2f%%, Position: %s, Score: %.2f',
            this.sym,
            100 * this.forecast,
            100 * this.volatility,
            this.buyPositionType,
            100 * 100 * this.estProfit
        ));
    }

    buy(budget: number): number {
        if (this.buyPositionType == 'Hold') {
            return 0;
        }

        const remainingShares = this.ns.stock.getMaxShares(this.sym) - this.shares;
        const estPrice = this.ns.stock.getPrice(this.sym);
        const shares = Math.min(Math.max(0, Math.floor(budget / estPrice)), remainingShares);

        if (shares <= 0) {
            return 0;
        }

        if (shares * estPrice < MIN_BUY_AMOUNT) {
            return 0;
        }

        const cost = this.ns.stock.getPurchaseCost(this.sym, shares, this.buyPositionType);

        if (this.buyPositionType === 'Long') {
            this.ns.stock.buy(this.sym, shares);
        } else if (this.buyPositionType === 'Short') {
            this.ns.stock.short(this.sym, shares);
        }

        this.ns.print(this.ns.sprintf(
            'WARNING Buying %s %s shares of %s for %s, Forecast: %.2f%%, Vol: %.2f%%',
            this.buyPositionType,
            this.ns.nFormat(shares, '0.000a'),
            this.sym,
            this.ns.nFormat(cost, '$0.000a'),
            100 * this.forecast,
            100 * this.volatility
        ));

        this.updatePosition();
        const price = this.ns.stock.getPrice(this.sym);
        this.setLastPriceHistoryItem(price);
        this.ticksSinceLastBuy = 0;
        return cost;
    }

    sellAll(reason: string): number {
        if (this.shares === 0 || this.positionType == 'None') {
            return 0;
        }

        const sales = this.ns.stock.getSaleGain(this.sym, this.shares, this.positionType);

        if (this.positionType === 'Long') {
            this.ns.stock.sell(this.sym, this.shares);
        } else if (this.positionType === 'Short') {
            this.ns.stock.sellShort(this.sym, this.shares);
        }

        const cost = this.shares * this.buyPrice + COMMISSION_FEE;
        const profit = sales - cost;
        const prefix = profit >= 0 ? '' : 'ERROR ';
        this.ns.print(this.ns.sprintf(
            '%sSelling %s %s shares of %s for %s, Profit: %s %.02f%%, Reason: %s, Forecast: %.2f%%, Vol: %.2f%%',
            prefix,
            this.positionType,
            this.ns.nFormat(this.shares, '0.000a'),
            this.sym,
            this.ns.nFormat(sales, '$0.000a'),
            this.ns.nFormat(profit, '$0.000a'),
            cost > 0 ? 100 * profit / cost : 0,
            reason,
            100 * this.forecast,
            100 * this.volatility
        ));

        this.totalCost += cost;
        this.totalSales += sales;
        this.positionType = 'None';
        this.shares = 0;
        this.buyPrice = 0;
        const price = this.ns.stock.getPrice(this.sym);
        this.setLastPriceHistoryItem(price);
        return sales;
    }

    costBuyAll(): number {
        const remainingShares = this.ns.stock.getMaxShares(this.sym) - this.shares;

        if (remainingShares <= 0 || this.buyPositionType == 'Hold') {
            return 0;
        }

        return this.ns.stock.getPurchaseCost(this.sym, remainingShares, this.buyPositionType);
    }

    salesSellAll(): number {
        if (this.shares == 0) {
            return 0;
        }

        return this.ns.stock.getSaleGain(this.sym, this.shares, this.positionType);
     }

    canSellAllProfitably(): boolean {
        const sales = this.salesSellAll();

        if (sales == 0) {
            return false;
        }

        const cost = this.shares * this.buyPrice + 2 * COMMISSION_FEE;
        const profit = sales - cost;
        return profit > 0;
    }

    reportPosition(): void {
        if (this.shares <= 0) {
            return;
        }

        const price = this.ns.stock.getPrice(this.sym);
        const sales = this.ns.stock.getSaleGain(this.sym, this.shares, this.positionType);
        const cost = this.shares * this.buyPrice + COMMISSION_FEE;
        const profit = sales - cost;
        const percentProfit = cost > 0 ? 100 * profit / cost : 0;
        this.ns.print(this.ns.sprintf(
            'INFO Owned %s: %s %s shares, Buy price: %s, Curr price: %s, Profit %s %.02f%%, Forecast: %.2f%%, Vol: %.2f%%',
            this.sym,
            this.positionType,
            this.ns.nFormat(this.shares, '0.000a'),
            this.ns.nFormat(this.buyPrice, '$0.000a'),
            this.ns.nFormat(price, '$0.000a'),
            this.ns.nFormat(profit, '$0.000a'),
            percentProfit,
            100 * this.forecast,
            100 * this.volatility
        ));
    }

    reportSales(): void {
        if (this.totalCost <= 0) {
            return;
        }

        const totalProfit = this.totalSales - this.totalCost
        const percentProfit = this.totalCost > 0 ? 100 * totalProfit / this.totalCost : 0;
        this.ns.print(this.ns.sprintf(
            'INFO Sales %s: Costs: %s, Sales: %s, Profit %s %.02f%%',
            this.sym,
            this.ns.nFormat(this.totalCost, '$0.000a'),
            this.ns.nFormat(this.totalSales, '$0.000a'),
            this.ns.nFormat(totalProfit, '$0.000a'),
            percentProfit
        ));
    }
}
