import { NS } from '@ns';
import { Stock, PRICE_HISTORY_LEN } from '/lib/Stock';

const TICK_TIME = 6000;
const WAIT_CYCLES_BEFORE_SELL = 10;
const REPORT_FREQUENCY = 50;
const BUDGET_RATIO = 0.5;

export async function main(ns : NS) : Promise<void> {
    ns.disableLog('ALL');
    ns.enableLog('print');
    const has4S = ns.stock.purchase4SMarketData()
        && ns.stock.purchase4SMarketDataTixApi();
    const symbols = ns.stock.getSymbols();
    const stocks = symbols.map(sym => new Stock(ns, sym, has4S));

    if (! has4S) {
        ns.print('INFO Populating price history');

        for (let i = 0; i < PRICE_HISTORY_LEN; ++i) {
            stocks.forEach(stock => stock.updatePriceHistory());
            await ns.sleep(TICK_TIME);
        }
    }

    let cycles = 0;

    while (true) {
        stocks.forEach(stock => stock.update());
        stocks.sort((a, b) => b.estProfit - a.estProfit);

        sellFlippedPositions(ns, stocks);
        sellUnderperformers(ns, stocks);
        buyStocks(ns, stocks);

        if (cycles % REPORT_FREQUENCY == 0) {
            printReport(ns, stocks);
        }

        await ns.sleep(TICK_TIME);
        ++cycles;
    }
}

function sellFlippedPositions(ns: NS, stocks: Stock[]) {
    stocks.filter(stock => stock.position != stock.newPosition)
        .filter(stock => stock.cyclesSinceLastBuy >= WAIT_CYCLES_BEFORE_SELL)
        .forEach(stock => stock.sellAll('Flipped'));
}

function sellUnderperformers(ns: NS, stocks: Stock[]): void {
    let totalWorth = 0;
    let totalWorthUnsellable = 0;

    for (const stock of stocks) {
        const sales = stock.salesSellAll();
        totalWorth += sales;

        if (! stock.canSellAllProfitably()) {
            totalWorthUnsellable += sales;
        }
    }

    const totalMoney = ns.getServerMoneyAvailable('home') + totalWorth;
    let budget = Math.max(0, Math.floor(totalMoney * BUDGET_RATIO - totalWorthUnsellable));

    for (const stock of stocks) {
        if (stock.shares == 0) {
            continue;
        }

        if (budget > 0) {
            budget -= stock.costBuyAll();
        } else {
            if (stock.canSellAllProfitably()) {
                stock.sellAll('Underperforming');
            }
        }
    }
}

function buyStocks(ns: NS, stocks: Stock[]): void {
    let totalWorth = 0;

    for (const stock of stocks) {
        totalWorth += stock.salesSellAll();
    }

    const totalMoney = ns.getServerMoneyAvailable('home') + totalWorth;
    let budget = Math.max(0, Math.floor((totalMoney * BUDGET_RATIO) - totalWorth));
    const remainingBudget = budget;

    for (const stock of stocks) {
        if (remainingBudget > 0) {
            budget -= stock.buy(budget);
        }
    }
}

function printReport(ns: NS, stocks: Stock[]): void {
    let totalSales = 0;
    let totalCost = 0;

    for (const stock of stocks) {
        stock.report();
        totalSales += stock.totalSales;
        totalCost += stock.totalCost;
    }

    const totalProfit = totalSales - totalCost;
    const percentProfit = totalCost > 0 ? totalProfit / totalCost : 0;

    ns.print(ns.sprintf(
        'INFO Totals: Sales: %s, Costs: %s, Profit: %s %.02f%%',
        ns.nFormat(totalSales, '$0.000a'),
        ns.nFormat(totalCost, '$0.000a'),
        ns.nFormat(totalProfit, '$0.000a'),
        percentProfit
    ));
}
