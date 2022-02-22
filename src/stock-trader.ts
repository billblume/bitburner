import { NS } from '@ns';
import { Stock } from '/lib/Stock';

const TICK_TIME = 6000;
const WARM_UP_TICKS = 40;
const REPORT_FREQUENCY = 75;
const BUDGET_RATIO = 0.5;
const MIN_PORTFOLIO_SIZE = 5;
const MIN_EST_PROFIT_GAIN = 1.3;

export async function main(ns : NS) : Promise<void> {
    ns.disableLog('ALL');
    ns.enableLog('print');
    const player = ns.getPlayer();
    const has4SData = player.has4SData;
    const symbols = ns.stock.getSymbols();
    const stocks = symbols.map(sym => new Stock(ns, sym, has4SData));

    if (! has4SData) {
        ns.print('INFO Populating price history');

        for (let i = 0; i < WARM_UP_TICKS; ++i) {
            stocks.forEach(stock => stock.updatePriceHistory());
            await ns.sleep(TICK_TIME);
        }
    }

    let tick = 0;

    while (true) {
        stocks.forEach(stock => stock.update());
        stocks.sort((a, b) => b.estProfit - a.estProfit);
        // stocks.forEach(stock => stock.printForecast());

        sellFlippedPositions(ns, stocks);
        sellUnderperformers(ns, stocks);
        buyStocks(ns, stocks);

        if (tick % REPORT_FREQUENCY == 0) {
            printReport(ns, stocks);
        }

        await ns.sleep(TICK_TIME);
        ++tick;
    }
}

function sellFlippedPositions(ns: NS, stocks: Stock[]) {
    stocks.filter(stock => stock.buyPositionType != 'Hold' && stock.positionType != stock.buyPositionType)
        .forEach(stock => stock.sellAll('Flipped'));
}

function sellUnderperformers(ns: NS, stocks: Stock[]): void {
    while (sellWorstPerformer(ns, stocks));
}

function sellWorstPerformer(ns: NS, stocks: Stock[]): boolean {
    const worstPerformer = stocks.filter(stock => stock.canSellAllProfitably()).at(-1);

    if (worstPerformer == undefined) {
        return false;
    }

    // Simulate a buyStocks() call with the worst performer sold.
    // If it isn't bought back, sell it for real.

    let totalCost = 0;

    for (const stock of stocks) {
        if (stock != worstPerformer) {
            totalCost += stock.cost;
        }
    }

    const totalMoney = ns.getServerMoneyAvailable('home') + totalCost + worstPerformer.saleGain;
    const totalBudget = Math.floor(totalMoney * BUDGET_RATIO);
    const maxPerStockBudget = Math.floor(totalBudget / MIN_PORTFOLIO_SIZE);
    let budget = Math.max(0, totalBudget - totalCost);
    let stockBought = false;
    let estProfitXCostBought = 0;
    let totalCostBought = 0;

    for (const stock of stocks) {
        if (budget <= 0) {
            break;
        }

        const shares = stock.numSharesToBuy(Math.min(budget, maxPerStockBudget), stock != worstPerformer);

        if (stock == worstPerformer) {
            if (shares > 0 || ! stockBought) {
                return false;
            }

            break;
        }

        if (shares > 0) {
            const costBought = stock.costBuy(shares);
            budget -= costBought;
            stockBought = true;
            estProfitXCostBought += costBought * stock.estProfit;
            totalCostBought += costBought;
        }
    }

    const estProfitBought = estProfitXCostBought / totalCostBought;

    if (estProfitBought / worstPerformer.estProfit < MIN_EST_PROFIT_GAIN) {
        return false;
    }

    worstPerformer.sellAll('Underperforming');
    return true;
}

function buyStocks(ns: NS, stocks: Stock[]): void {
    let totalCost = 0;

    for (const stock of stocks) {
        totalCost += stock.cost;
    }

    const totalMoney = ns.getServerMoneyAvailable('home') + totalCost;
    const totalBudget = Math.floor(totalMoney * BUDGET_RATIO);
    const maxPerStockBudget = Math.floor(totalBudget / MIN_PORTFOLIO_SIZE);
    let budget = Math.max(0, totalBudget - totalCost);

    for (const stock of stocks) {
        if (budget <= 0) {
            break;
        }

        const shares = stock.numSharesToBuy(Math.min(budget, maxPerStockBudget), true);
        budget -= stock.buy(shares);
    }
}

function printReport(ns: NS, stocks: Stock[]): void {
    stocks
        .filter(stock => stock.shares > 0)
        .sort((a, b) => Math.abs(b.profit) - Math.abs(a.profit))
        .forEach(stock => stock.reportPosition());

    let totalSales = 0;
    let totalCost = 0;

    for (const stock of stocks) {
        // stock.reportSales();
        totalSales += stock.totalSales;
        totalCost += stock.totalCost;
    }

    const totalProfit = totalSales - totalCost;
    const percentProfit = totalCost > 0 ? 100 * totalProfit / totalCost : 0;

    ns.print(ns.sprintf(
        'INFO    Total                       %8s, Pft: %9s %6.02f%%',
        ns.nFormat(totalSales, '$0.00a'),
        ns.nFormat(totalProfit, '$0.00a'),
        percentProfit
    ));
}
