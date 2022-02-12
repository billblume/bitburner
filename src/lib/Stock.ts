import { NS } from '@ns'

export const PRICE_HISTORY_LEN = 40;
const COMMISSION_FEE = 100000;

export class Stock {
    ns: NS;
    sym: string;
    has4S: boolean;
    priceHistory: number[];
    position: string;
    shares: number;
    buyPrice: number;
    forecast: number;
    volatility: number;
    newPosition: string;
    estProfit: number;
    totalCost: number;
    totalSales: number;
    cyclesSinceLastBuy: number;

    constructor(ns: NS, sym: string, has4S: boolean) {
        this.ns = ns;
        this.sym = sym;
        this.has4S = has4S;
        this.priceHistory = [];
        this.position = 'None';
        this.shares = 0;
        this.buyPrice = 0;
        this.forecast = 0.5;
        this.volatility = 0;
        this.newPosition = 'None';
        this.estProfit = 0;
        this.totalCost = 0;
        this.totalSales = 0;
        this.cyclesSinceLastBuy = 0;
    }

    update(): void {
        this.updatePosition();
        this.updatePriceHistory();
        this.updateForecast();
    }

    updatePosition(): void {
        const positionInfo = this.ns.stock.getPosition(this.sym);

        if (positionInfo[0] > 0) {
            this.position = 'Long';
            this.shares = positionInfo[0];
            this.buyPrice = positionInfo[1];
        } else if (positionInfo[2] > 0) {
            this.position = 'Short';
            this.shares = positionInfo[2];
            this.buyPrice = positionInfo[3];
        } else {
            this.position = 'None';
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
        ++this.cyclesSinceLastBuy;
    }

    setLastPriceHistoryItem(price: number): void {
        this.priceHistory[this.priceHistory.length - 1] = price;
    }

    updateForecast(): void {
        if (this.has4S) {
            this.forecast = this.ns.stock.getForecast(this.sym);
            this.volatility = this.ns.stock.getVolatility(this.sym);
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

            this.forecast = numPriceIncreases / this.priceHistory.length;
        }

        this.newPosition = (this.forecast >= 0.5 ? 'Long' : 'Short');

        if (this.newPosition == 'Short') {
            this.newPosition = 'None';
        }

        this.estProfit = (this.forecast - 0.5) * this.volatility;
    }

    buy(budget: number): number {
        const remainingShares = this.ns.stock.getMaxShares(this.sym) - this.shares;
        const estPrice = this.ns.stock.getPrice(this.sym);
        const shares = Math.min(Math.floor(budget / estPrice), remainingShares);

        if (shares == 0) {
            return 0;
        }

        let price;

        if (this.newPosition === 'Long') {
            price = this.ns.stock.buy(this.sym, shares);
        } else if (this.newPosition === 'Short') {
            price = this.ns.stock.short(this.sym, shares);
        } else {
           return 0;
        }

        const cost = shares * price + COMMISSION_FEE;
        this.ns.print(this.ns.sprintf(
            'Buying %s %s shares of %s for %s',
            this.newPosition,
            this.ns.nFormat(shares, '0.000a'),
            this.sym,
            this.ns.nFormat(cost, '$0.000a'),
        ));

        this.updatePosition();
        this.setLastPriceHistoryItem(price);
        this.cyclesSinceLastBuy = 0;
        return cost;
    }

    sellAll(reason: string): number {
        let price;

        if (this.position === 'Long') {
            price = this.ns.stock.sell(this.sym, this.shares);
        } else if (this.position === 'Short') {
            price = this.ns.stock.sellShort(this.sym, this.shares);
        } else {
            return 0;
        }

        const sales = this.shares * price;
        const cost = this.shares * this.buyPrice + COMMISSION_FEE;
        const profit = sales - cost;
        this.ns.print(this.ns.sprintf(
            'Selling %s %s shares of %s for %s, Profit: %s %.02f%%, Reason: %s',
            this.position,
            this.ns.nFormat(this.shares, '0.000a'),
            this.sym,
            this.ns.nFormat(sales, '$0.000a'),
            this.ns.nFormat(profit, '$0.000a'),
            cost > 0 ? 100 * profit / cost : 0,
            reason
        ));

        this.totalCost += cost;
        this.totalSales += sales;
        this.position = 'None';
        this.shares = 0;
        this.buyPrice = 0;
        this.setLastPriceHistoryItem(price);
        return sales;
    }

    costBuyAll(): number {
        const remainingShares = this.ns.stock.getMaxShares(this.sym) - this.shares;

        if (remainingShares <= 0 || this.newPosition == 'None') {
            return 0;
        }

        return this.ns.stock.getPurchaseCost(this.sym, remainingShares, this.newPosition);
    }

    salesSellAll(): number {
        if (this.shares == 0) {
            return 0;
        }

        return this.ns.stock.getSaleGain(this.sym, this.shares, this.position);
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

    report(): void {
        if (this.totalCost <= 0 && this.shares <= 0) {
            return;
        }

        const totalProfit = this.totalSales - this.totalCost
        const percentProfit = this.totalCost > 0 ? 100 * totalProfit / this.totalCost : 0;
        this.ns.print(this.ns.sprintf(
            'INFO %s %s shares of %s at %s, Sold %s for profit %s %.02f%%',
            this.position,
            this.ns.nFormat(this.shares, '0.000a'),
            this.sym,
            this.ns.nFormat(this.shares * this.buyPrice, '$0.000a'),
            this.ns.nFormat(this.totalSales, '$0.000a'),
            this.ns.nFormat(totalProfit, '$0.000a'),
            percentProfit
        ));
    }
}
