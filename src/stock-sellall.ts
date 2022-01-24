import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
    ns.kill('stock-trader.ns', 'home');
    const symbols = ns.stock.getSymbols();

    symbols.forEach(sym => {
        const position = ns.stock.getPosition(sym);
        const shares = position[0];
        ns.stock.sell(sym, shares);
    });

    return Promise.resolve();
}
