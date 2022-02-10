import { NS } from '@ns'
import { getAllServerHostnames } from '/lib/server';
import { canCrackServer, crackServer } from '/lib/crack';
import { ServerHackScore } from './lib/ServerHackScore';
import { ServerHackScheduler, ServerThreads } from '/lib/ServerHackScheduler';

const SERVER_BUY_AND_CRACK_SECS = 5 * 60;
const SERVER_BUDGET_RATIO_LOW = 0.5;
const SERVER_BUDGET_RATIO_LOW_CUTOFF = 1e6;
const SERVER_BUDGET_RATIO_HIGH = 0.05;
const HACKNET_NODE_WEIGHT = 1;
const HACKNET_LEVEL_WEIGHT = 1;
const HACKNET_RAM_WEIGHT = 1;
const HACKNET_CORE_WEIGHT = 5;
const HACKNET_CACHE_WEIGHT = 2;
const HACKNET_MONEY_SELL_ALL_HASHES = 25000000;
const HACKNET_MAX_HASH_CAPACITY_RATIO = 0.8;

const MAX_WEAKEN_TIME = 5 * 60;
const HACK_MONEY_FRACTION = 0.5;
const MIN_SCORE_FRACTION = 0.01;

export async function main(ns : NS) : Promise<void> {
    ns.disableLog('ALL');
    ns.enableLog('print');
    let targetHostnames: ServerThreads[] = [];
    const scheduler = new ServerHackScheduler(ns);
    await scheduler.updateServerInfo();
    scheduler.killAllAgents();
    let lastBuyAndHackTime = 0;

    for (let cycle = 0; ; ++cycle) {
        const now = (new Date()).getTime() / 1000;

        if (now >= lastBuyAndHackTime + SERVER_BUY_AND_CRACK_SECS) {
            scheduler.printStats();
            sellExcessHacknetHashes(ns);
            const rootedHostnames = buyAndCrackServers(ns);
            await scheduler.updateServerInfo();
            targetHostnames = getBestServers(ns, rootedHostnames, scheduler.getTotalThreads());
            scheduler.setServersToHack(targetHostnames);
            spendHacknetHashes(ns, targetHostnames);
            lastBuyAndHackTime = now;
        }

        await scheduler.runOneCycle();
    }

    return Promise.resolve();
}

function sellExcessHacknetHashes(ns: NS): void {
    const money = ns.getServerMoneyAvailable('home');
    const numHashes = ns.hacknet.numHashes();
    let hashesToSell = 0;

    if (money < HACKNET_MONEY_SELL_ALL_HASHES) {
        hashesToSell = numHashes;
    } else {
        const hashCap = ns.hacknet.hashCapacity()
        hashesToSell = Math.max(0, numHashes - Math.floor(HACKNET_MAX_HASH_CAPACITY_RATIO * hashCap));
    }

    const sellCost = ns.hacknet.hashCost('Sell for Money');
    const sellCount = Math.floor(hashesToSell / sellCost);

    if (sellCount > 0) {
        for (let i = 0; i < sellCount; ++i) {
            ns.hacknet.spendHashes('Sell for Money');
        }

        ns.print(`Sold ${sellCount * sellCost} hashes for $${sellCount}M.`);
    }
}

function spendHacknetHashes(ns: NS, targetHostnames: ServerThreads[]): void {
    let success = true;

    while (success) {
        success = false;
        const numHashes = ns.hacknet.numHashes();

        if (numHashes <= 0) {
            return;
        }

        const player = ns.getPlayer();
        const workType = player.workType.toLowerCase();

        if (workType.indexOf('university') != -1) {
            success = spendHashes(ns, 'Improve Studying');

            if (success) {
                continue;
            }
        }

        if (workType.indexOf('gym') != -1) {
            success = spendHashes(ns, 'Improve Gym Training');

            if (success) {
                continue;
            }
        }

        if (player.factions.includes('Bladeburners')) {
            success = spendHashes(ns, 'Exchange for Bladeburner Rank');

            if (success) {
                continue;
            }

            success = spendHashes(ns, 'Exchange for Bladeburner SP');

            if (success) {
                continue;
            }
        }

        if (player.hasCorporation) {
            success = spendHashes(ns, 'Sell for Corporation Funds');

            if (success) {
                continue;
            }
        }

        success = spendHashes(ns, 'Reduce Minimum Security', targetHostnames[0].hostname);

        if (success) {
            continue;
        }

        success = spendHashes(ns, 'Increase Maximum Money', targetHostnames[0].hostname);

        if (success) {
            continue;
        }

        success = spendHashes(ns, 'Generate Coding Contract');

        if (success) {
            continue;
        }
    }
}

function spendHashes(ns: NS, upgName: string, upgTarget?: string|undefined): boolean {
    const numHashes = ns.hacknet.numHashes();
    const hashCost = ns.hacknet.hashCost(upgName);
    let success = false;

    if (hashCost <= numHashes) {
        success = ns.hacknet.spendHashes(upgName, upgTarget);

        if (success) {
            ns.print(`Spent ${hashCost} hashes to ${upgName}.`);
        }
    }

    return success;
}

function buyAndCrackServers(ns: NS): string[] {
    const budget = getServerBudget(ns);
    ns.print(`INFO: Server budget: ` + ns.nFormat(budget, '$0.00a'));
    buyPrivateServers(ns, budget);
    buyHacknetServers(ns, budget);
    const allHostnames = getAllServerHostnames(ns);
    crackServers(ns, allHostnames);
    const rootedHostnames = allHostnames.filter(hostname => ns.hasRootAccess(hostname));
    return rootedHostnames;
}

function getServerBudget(ns: NS): number {
    const money = ns.getServerMoneyAvailable("home");
    let budget = 0;

    if (money <= SERVER_BUDGET_RATIO_LOW_CUTOFF) {
        budget = money * SERVER_BUDGET_RATIO_LOW;
    } else {
        budget = SERVER_BUDGET_RATIO_LOW_CUTOFF * SERVER_BUDGET_RATIO_LOW +
            (money - SERVER_BUDGET_RATIO_LOW_CUTOFF) * SERVER_BUDGET_RATIO_HIGH;
    }

    return budget;
}

function buyPrivateServers(ns: NS, budget: number): void {
    const numServers = ns.getPurchasedServerLimit();
    const perServerBudget = budget / numServers;
    let ram = 8;

    while (2 * ram <= ns.getPurchasedServerMaxRam()) {
        if (ns.getPurchasedServerCost(2 * ram) > perServerBudget) {
            break;
        }

        ram *= 2;
    }

    const cost = ns.getPurchasedServerCost(ram);

    for (let i = 0; i < numServers; ++i) {
        const hostname = 'pserv-' + String(i);

        if (ns.serverExists(hostname)) {
            if (ns.getServerMaxRam(hostname) >= ram) {
                continue;
            }

            ns.killall(hostname);
            ns.deleteServer(hostname);
        }


        if (ns.getServerMoneyAvailable("home") < cost) {
            // ns.print('Not enough money to buy more servers.');
            return;
        }

        ns.print(`Purchasing ${hostname} with ${ram}GB RAM for ${ns.nFormat(cost, '$0.00a')}.`)
        ns.purchaseServer(hostname, ram);
    }
}

function buyHacknetServers(ns: NS, budget: number): void {
     while (budget > 0) {
        const cost = buyCheapestHacknetUpgrade(ns, budget);

        if (cost <= 0) {
            break;
        }

        budget -= cost;
    }
}

function buyCheapestHacknetUpgrade(ns: NS, budget: number): number {
    let items = [];
    const numNodes = ns.hacknet.numNodes();

    if (numNodes < ns.hacknet.maxNumNodes()) {
        const nodeCost = ns.hacknet.getPurchaseNodeCost();
        items.push({
            action: 'purchaseNode',
            node: numNodes,
            cost: nodeCost,
            weightedCost: HACKNET_NODE_WEIGHT * nodeCost
        });
    }

    for (let i = 0; i < numNodes; ++i) {
        const levelCost = ns.hacknet.getLevelUpgradeCost(i, 1);
        const ramCost = ns.hacknet.getRamUpgradeCost(i, 1);
        const coreCost = ns.hacknet.getCoreUpgradeCost(i, 1);
        const cacheCost = ns.hacknet.getCacheUpgradeCost(i, 1);
        items.push({
            action: 'upgradeLevel',
            node: i,
            cost: levelCost,
            weightedCost: HACKNET_LEVEL_WEIGHT * levelCost
        });
        items.push({
            action: 'upgradeRam',
            node: i,
            cost: ramCost,
            weightedCost: HACKNET_RAM_WEIGHT * ramCost
        });
        items.push({
            action: 'upgradeCore',
            node: i,
            cost: coreCost,
            weightedCost: HACKNET_CORE_WEIGHT * coreCost
        });
        items.push({
            action: 'upgradeCache',
            node: i,
            cost: cacheCost,
            weightedCost: HACKNET_CACHE_WEIGHT * cacheCost
        });
    }

    items = items.filter(item => item.cost <= budget);

    if (items.length > 0) {
        items.sort((a, b) => a.weightedCost - b.weightedCost);
        const cheapest = items[0];
        let actionMessage = '???';
        let success = false;

        switch (cheapest.action) {
            case 'purchaseNode':
                actionMessage = 'Purchased node';
                success = ns.hacknet.purchaseNode() != -1;
                break;

            case 'upgradeLevel':
                actionMessage = 'Upgraded level';
                success = ns.hacknet.upgradeLevel(cheapest.node, 1);
                break;

            case 'upgradeRam':
                actionMessage = 'Upgraded ram';
                success = ns.hacknet.upgradeRam(cheapest.node, 1);
                break;

            case 'upgradeCore':
                actionMessage = 'Upgraded cores';
                success = ns.hacknet.upgradeCore(cheapest.node, 1);
                break;

            case 'upgradeCache':
                actionMessage = 'Upgraded cache';
                success = ns.hacknet.upgradeCache(cheapest.node, 1);
                break;
        }

        if (success) {
            ns.print(`${actionMessage} for hacknet node #${cheapest.node} for ` +
                ns.nFormat(cheapest.cost, '$0.00a'));

            return items[0].cost;
        }
    }

    return 0;
}

function crackServers(ns: NS, hostnames: string[]): void {
    for (const hostname of hostnames) {
        if (canCrackServer(ns, hostname)) {
            ns.print(`Cracking ${hostname}`);
            crackServer(ns, hostname);
        }
    }
}

function getBestServers(ns: NS, hostnames: string[], availThreads: number): ServerThreads[] {
    ns.print(`INFO: There are ${availThreads} available server threads.`);
    const serverScores = getServerScores(ns, hostnames, availThreads);
    const bestServers: ServerThreads[] = [];
    const serverDescrs: string[] = [];
    let bestWeakenServer: string|null = null;
    let bestWeakenScore = 0;
    let bestScore = 0;

    for (const score of serverScores) {
        ns.print('INFO: Est: ' + score.toString(ns));
        const threads = Math.max(score.weakenThreads, score.initialWeakenThreads, score.hackThreads, score.growThreads);

        if (bestServers.length == 0 || (availThreads >= threads && score.score >= bestScore * MIN_SCORE_FRACTION)) {
            if (bestServers.length == 0) {
                bestScore = score.score;
            }

            bestServers.push({
               hostname: score.hostname,
               threads: threads
            });
            serverDescrs.push(`${score.hostname}:${threads}`);
            availThreads -= threads;
        } else if (bestWeakenScore < score.weakenScore) {
            bestWeakenServer = score.hostname;
            bestWeakenScore = score.weakenScore;
        }
    }

    if (availThreads > 0 && bestWeakenServer) {
        // Put all remaining threads on server solely to weaken it to get its security down.
        bestServers.push({
            hostname: bestWeakenServer,
            threads: availThreads
        })
        serverDescrs.push(`${bestWeakenServer}:${availThreads}`);
    }

    ns.print(`Selected servers ${serverDescrs.join(', ')} for hacking`);
    return bestServers;
}

function getServerScores(ns: NS, hostnames: string[], totalThreads: number): ServerHackScore[] {
    return hostnames
        .filter(hostname => hostname != 'home')
        .filter(hostname => ns.getServerMaxMoney(hostname) > 0)
        .filter(hostname => ns.getWeakenTime(hostname) / 1000 <= MAX_WEAKEN_TIME)
        .map(hostname => new ServerHackScore(ns, hostname, totalThreads, HACK_MONEY_FRACTION))
        .sort((a: ServerHackScore, b: ServerHackScore) => b.score - a.score);
}
