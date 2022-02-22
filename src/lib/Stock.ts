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
    saleGain: number;
    cost: number;
    profit: number;
    profitRatio: number;
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
        this.saleGain = 0;
        this.cost = 0;
        this.profit = 0;
        this.profitRatio = 0;
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

        if (this.shares > 0) {
            this.saleGain = this.ns.stock.getSaleGain(this.sym, this.shares, this.positionType);
            this.cost = this.shares * this.buyPrice + COMMISSION_FEE;
            this.profit = this.saleGain - this.cost;
            this.profitRatio = this.cost > 0 ? this.profit / this.cost : 0;
        } else {
            this.saleGain = 0;
            this.cost = 0;
            this.profit = 0;
            this.profitRatio = 0;
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

    buy(shares: number): number {
        if (shares <= 0) {
            return 0;
        }

        const cost = this.ns.stock.getPurchaseCost(this.sym, shares, this.buyPositionType);

        if (this.buyPositionType === 'Long') {
            this.ns.stock.buy(this.sym, shares);
        } else if (this.buyPositionType === 'Short') {
            this.ns.stock.short(this.sym, shares);
        }

        this.ns.print(this.ns.sprintf(
            'WARNING Buy  %5s %7s %5s at %8s, Pft:     -.--    -.--%%, Fcst: %5.2f%%, Vol: %4.2f%%',
            this.sym,
            this.ns.nFormat(shares, '0.00a'),
            this.buyPositionType,
            this.ns.nFormat(cost, '$0.00a'),
            100 * this.forecast,
            100 * this.volatility
        ));

        this.updatePosition();
        const price = this.ns.stock.getPrice(this.sym);
        this.setLastPriceHistoryItem(price);
        this.ticksSinceLastBuy = 0;
        return cost;
    }

    numSharesToBuy(targetCost: number, subtractCurrentCost: boolean) {
        if (this.buyPositionType == 'Hold') {
            return 0;
        }

        targetCost -= COMMISSION_FEE;

        if (subtractCurrentCost) {
            targetCost -= this.cost;
        }

        if (targetCost <= 0) {
            return 0;
        }

        const remainingShares = this.ns.stock.getMaxShares(this.sym) - this.shares;
        const estPrice = this.buyPositionType == 'Long' ? this.ns.stock.getAskPrice(this.sym) : this.ns.stock.getBidPrice(this.sym);
        const shares = Math.min(Math.max(0, Math.floor(targetCost / estPrice)), remainingShares);

        if (shares <= 0) {
            return 0;
        }

        if (shares * estPrice < MIN_BUY_AMOUNT) {
            return 0;
        }

        return shares;
    }

    sellAll(reason: string): number {
        if (this.shares === 0 || this.positionType == 'None') {
            return 0;
        }

        if (this.positionType === 'Long') {
            this.ns.stock.sell(this.sym, this.shares);
        } else if (this.positionType === 'Short') {
            this.ns.stock.sellShort(this.sym, this.shares);
        }

        const prefix = this.profitRatio >= 0 ? '       ' : 'ERROR  ';
        this.ns.print(this.ns.sprintf(
            '%s Sell %5s %7s %5s at %8s, Pft: %9s %6.02f%%, Fcst: %5.2f%%, Vol: %4.2f%%, Reason: %s',
            prefix,
            this.sym,
            this.ns.nFormat(this.shares, '0.00a'),
            this.positionType,
            this.ns.nFormat(this.saleGain, '$0.00a'),
            this.ns.nFormat(this.profit, '$0.00a'),
            100 * this.profitRatio,
            100 * this.forecast,
            100 * this.volatility,
            reason,
        ));

        this.totalCost += this.cost;
        this.totalSales += this.saleGain;
        const sales = this.saleGain;
        this.updatePosition();
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

    costBuy(shares: number): number {
        if (shares <= 0) {
            return 0;
        }

        return this.ns.stock.getPurchaseCost(this.sym, shares, this.buyPositionType);
    }

    salesSellAll(): number {
        return this.saleGain;
    }

    canSellAllProfitably(): boolean {
        return this.saleGain > this.cost;
    }

    reportPosition(): void {
        if (this.shares <= 0) {
            return;
        }

        this.ns.print(this.ns.sprintf(
            'INFO    Hold %5s %7s %5s at %8s, Pft: %9s %6.02f%%, Fcst: %5.2f%%, Vol: %4.2f%%',
            this.sym,
            this.ns.nFormat(this.shares, '0.00a'),
            this.positionType,
            this.ns.nFormat(this.saleGain, '$0.00a'),
            this.ns.nFormat(this.profit, '$0.00a'),
            100 * this.profitRatio,
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
