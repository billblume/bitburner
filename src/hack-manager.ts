import { NS } from '@ns'
import { getAllServerHostnames } from '/lib/server';
import { canCrackServer, crackServer } from '/lib/crack';

const SERVER_BUY_AND_CRACK_FREQUENCY = 10;
const SERVER_BUDGET_RATIO_LOW = 0.5;
const SERVER_BUDGET_RATIO_LOW_CUTOFF = 1e6;
const SERVER_BUDGET_RATIO_HIGH = 0.01;
const HACKNET_NODE_WEIGHT = 1;
const HACKNET_LEVEL_WEIGHT = 1;
const HACKNET_RAM_WEIGHT = 1;
const HACKNET_CORE_WEIGHT = 5;
const HACKNET_CACHE_WEIGHT = 2;
const HACKNET_MONEY_SELL_ALL_HASHES = 25000000;
const HACKNET_MAX_HASH_CAPACITY_RATIO = 0.8;

const RESERVED_HOME_RAM = 128;
const HACKNET_RAM_SCRIPTING_FRACTION = 0.5;
const MIN_AVAILABLE_RAM = 4;
const MAX_WEAKEN_TIME = 5 * 60;
const ESTIMATED_PERCENT_TIME_HACKING = 0.2;
const WEAKEN_LOWER_THRESHOLD = 0.95;
const WEAKEN_UPPER_THRESHOLD = 1;
const GROW_LOWER_THRESHOLD = 0.75;
const GROW_UPPER_THRESHOLD = 0.9;
const HACK_MONEY_FRACTION = 0.5;

enum HackAction {
    Grow = 'grow',
    Weaken = 'weaken',
    Hack = 'hack',
    None = 'none',
}

interface ServerScore {
    hostname: string,
    score: number,
    maxMoney: number,
    security: number,
    minSecurity: number,
    growThreads: number,
    hackThreads: number,
    cycles: number,
    hackTime: number,
    moneyPerSec: number
}

interface HackTimings {
    [key: string]: number
}

export async function main(ns : NS) : Promise<void> {
    ns.disableLog('ALL');
    ns.enableLog('print');
    let farmableHostnames: string[] = [];
    let targetHostname = '';
    let lastAction = HackAction.None;
    const timings: HackTimings = {};
    Object.values(HackAction).forEach(action => timings[action] = 0);

    for (let cycle = 0; ; ++cycle) {
        if (cycle % SERVER_BUY_AND_CRACK_FREQUENCY == 0) {
            sellExcessHacknetHashes(ns);
            const rootedHostnames = buyAndCrackServers(ns);
            targetHostname = getBestServer(ns, rootedHostnames);
            farmableHostnames = getFarmableHostnames(ns, rootedHostnames);
            await installAgents(ns, farmableHostnames);
            spendHacknetHashes(ns, targetHostname);
        }

        const action: HackAction = await hackServer(
            ns,
            targetHostname,
            farmableHostnames,
            cycle,
            lastAction,
            timings
        );
        lastAction = action;
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

function spendHacknetHashes(ns: NS, targetHostname: string): void {
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
        } else if (workType.indexOf('gym') != -1) {
            success = spendHashes(ns, 'Improve Gym Training');

            if (success) {
                continue;
            }
        } else if (workType.indexOf('bladeburner') != -1) {
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

        success = spendHashes(ns, 'Reduce Minimum Security', targetHostname);

        if (success) {
            continue;
        }

        success = spendHashes(ns, 'Increase Maximum Money', targetHostname);

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
    ns.print(`Server budget: ` + ns.nFormat(budget, '$0.00a'));
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
        budget = money * SERVER_BUDGET_RAITO_LOW;
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

        ns.print(`Purchasing ${hostname} with ${ram}GB RAM for $${ns.nFormat(cost, '$0.00a')}.`)
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

function getBestServer(ns: NS, hostnames: string[]): string {
    const availThreads = estimateAvailableThreads(ns, hostnames);
    // ns.print(`There are ${availThreads} available server threads.`);
    const serverScores = getServerScores(ns, hostnames, availThreads);
    // serverScores.forEach(score => printScore(ns, score));
    const bestHostname = serverScores[0].hostname;
    ns.print(`Selected server ${bestHostname} for hacking`);
    // printScore(ns, serverScores[0]);
    return bestHostname;
}

function estimateAvailableThreads(ns: NS, hostnames: string[]): number {
    let totalThreads = 0;
    const growRam = ns.getScriptRam(getScript(HackAction.Grow));

    for (const hostname of hostnames) {
        const availRam = getServerAvailableRam(ns, hostname);
        totalThreads += Math.floor(availRam / growRam);
    }

    return totalThreads;
}

function getServerAvailableRam(ns: NS, hostname: string): number {
    let ram = ns.getServerMaxRam(hostname);

    if (hostname == 'home') {
        ram = Math.max(0, ram - RESERVED_HOME_RAM);
    } else if (hostname.startsWith('hacknet-node-')) {
        ram = Math.floor(ram * HACKNET_RAM_SCRIPTING_FRACTION);
    }

    if (ram < MIN_AVAILABLE_RAM) {
        return 0;
    }

    return ram;
}

function getServerScores(ns: NS, hostnames: string[], totalThreads: number): ServerScore[] {
    return hostnames
        .filter(hostname => hostname != 'home')
        .filter(hostname => ns.getServerMoneyAvailable(hostname) > 0)
        .filter(hostname => ns.getWeakenTime(hostname) / 1000 <= MAX_WEAKEN_TIME)
        .map(hostname => getServerScore(ns, hostname, totalThreads))
        .sort((a: ServerScore, b: ServerScore) => b.score - a.score);
}

function getServerScore(ns: NS, hostname: string, totalThreads: number): ServerScore {
    const maxMoney = ns.getServerMaxMoney(hostname);
    const security = ns.getServerSecurityLevel(hostname);
    const minSecurity = ns.getServerMinSecurityLevel(hostname);
    const securityMult = (100 - minSecurity) / (100 - security);
    const farmableMoney = maxMoney * HACK_MONEY_FRACTION;
    const growthAmount = 1 / (1 - HACK_MONEY_FRACTION);
    const growThreads = Math.ceil(ns.growthAnalyze(hostname, growthAmount) / securityMult);
    const hackThreads = Math.ceil(HACK_MONEY_FRACTION / ns.hackAnalyze(hostname) / securityMult);
    const cycles = Math.ceil(growThreads / totalThreads) + Math.ceil(hackThreads / totalThreads);
    const hackTime = Math.ceil(ns.getHackTime(hostname) / 1000 / securityMult);
    const moneyPerSec = Math.floor(farmableMoney * ESTIMATED_PERCENT_TIME_HACKING / hackTime / cycles);

    const score = moneyPerSec;

    return {
        hostname: hostname,
        score: score,
        maxMoney: maxMoney,
        security: security,
        minSecurity: minSecurity,
        growThreads: growThreads,
        hackThreads: hackThreads,
        cycles: cycles,
        hackTime: hackTime,
        moneyPerSec: moneyPerSec
    };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function printScore(ns: NS, score: ServerScore): void {
    ns.print(ns.sprintf(
        '%s: Money: %s (%s/s), Sec: %d/%d, Thr: G:%d/H:%d, Hack: %ds, Cyc: %d',
        score.hostname,
        ns.nFormat(score.maxMoney, '$0.00a'),
        ns.nFormat(score.moneyPerSec, '$0.00a'),
        score.security,
        score.minSecurity,
        score.growThreads,
        score.hackThreads,
        score.hackTime,
        score.cycles
    ));
}

function getFarmableHostnames(ns: NS, rootedHostnames: string[]): string[] {
    return rootedHostnames.filter(hostname => getServerAvailableRam(ns, hostname) > 0);
}

function getAgents(ns: NS): string[] {
    return ns.ls('home').filter(file => file.startsWith('/agent/'));
}

async function installAgents(ns: NS, farmableHostnames: string[]): Promise<void> {
    const files = getAgents(ns);

    for (const hostname of farmableHostnames) {
        await ns.scp(files, 'home', hostname);
    }
}

async function hackServer(
    ns: NS,
    targetHostname: string,
    farmableHostnames: string[],
    cycle: number,
    lastAction: HackAction,
    timings: HackTimings
): Promise<HackAction> {
    const maxMoney = ns.getServerMaxMoney(targetHostname);
    const minSecLevel = ns.getServerMinSecurityLevel(targetHostname);
    const action = getAction(ns, targetHostname, lastAction);
    const runTime = Math.max(0.1, getRunTime(ns, targetHostname, action));
    const maxThreads = getMaxThreads(ns, targetHostname, action);
    const script = getScript(action);
    let totalThreads = 0;

    for (const hostname of farmableHostnames) {
        getAgents(ns).forEach(script => ns.scriptKill(script, hostname));
        const scriptRam = ns.getScriptRam(script, hostname);
        const serverThreads = Math.floor(getServerAvailableRam(ns, hostname) / scriptRam);
        const threads = Math.min(maxThreads - totalThreads, serverThreads);

        if (threads > 0) {
            if (ns.exec(script, hostname, threads, targetHostname)) {
                totalThreads += threads;
            } else {
                ns.print(`Error running script ${script} on ${hostname} with ${threads} threads`);
            }
        }
    }

    timings[action] += runTime;
    let totalTime = 0;

    for (const anAction in timings) {
        totalTime += timings[anAction];
    }

    if (totalTime > 0) {
        const money = ns.getServerMoneyAvailable(targetHostname);
        const secLevel = ns.getServerSecurityLevel(targetHostname);

        ns.print(ns.sprintf(
            '%3d %6s %3d x %5.1fs:'
            + '  Times: %5.1fs (G%03d/W%03d/H%03d).'
            + '  Money: %6s/%6s.'
            + '  Sec: %3d/%3d.',
            cycle,
            action,
            totalThreads,
            runTime,
            totalTime,
            timings[HackAction.Grow] * 100 / totalTime,
            timings[HackAction.Weaken] * 100 / totalTime,
            timings[HackAction.Hack] * 100 / totalTime,
            ns.nFormat(money, '$0.00a'),
            ns.nFormat(maxMoney, '$0.00a'),
            secLevel,
            minSecLevel
        ));
    }

    await ns.sleep(runTime * 1000 + 100);
    return action;
}

function getAction(ns: NS, targetHostname: string, lastAction: HackAction): HackAction {
    const securityLevel = ns.getServerSecurityLevel(targetHostname);
    const hackFactor = Math.max(0, 100 - securityLevel);
    const minSecurityLevel = ns.getServerMinSecurityLevel(targetHostname);
    const hackMaxFactor = Math.max(0, 100 - minSecurityLevel);
    const maxMoney = ns.getServerMaxMoney(targetHostname);
    const money = ns.getServerMoneyAvailable(targetHostname);

    if (lastAction == HackAction.Weaken && hackFactor < hackMaxFactor * WEAKEN_UPPER_THRESHOLD) {
        return HackAction.Weaken;
    } else if (hackFactor < hackMaxFactor * WEAKEN_LOWER_THRESHOLD) {
        return HackAction.Weaken;
    } else if (lastAction == HackAction.Grow && money < maxMoney * GROW_UPPER_THRESHOLD) {
        return HackAction.Grow;
    } else if (money < maxMoney * GROW_LOWER_THRESHOLD) {
        return HackAction.Grow;
    } else {
        return HackAction.Hack;
    }
}

function getRunTime(ns: NS, targetHostname: string, action: HackAction): number {
    switch (action) {
        case HackAction.Grow:
            return ns.getGrowTime(targetHostname) / 1000;

        case HackAction.Weaken:
            return ns.getWeakenTime(targetHostname) / 1000;

        case HackAction.Hack:
            return ns.getHackTime(targetHostname) / 1000;
    }

    return 0;
}

function getScript(action: HackAction): string {
    switch (action) {
        case HackAction.Grow:
            return '/agent/grow.js';

        case HackAction.Weaken:
            return '/agent/weaken.js';

        case HackAction.Hack:
            return '/agent/hack.js'
    }

    return '';
}

function getMaxThreads(ns: NS, targetHostname: string, action: HackAction): number {
    switch (action) {
        case HackAction.Grow: {
            const maxMoney = ns.getServerMaxMoney(targetHostname);
            const moneyAvailable = ns.getServerMoneyAvailable(targetHostname);

            if (moneyAvailable > 0) {
                const growAmount = maxMoney / moneyAvailable;
                return Math.ceil(ns.growthAnalyze(targetHostname, growAmount));
            } else {
                return 1000000000;
            }
        }

        case HackAction.Weaken:
            return 1000000000;

        case HackAction.Hack: {
            const hackAmount = Math.ceil(Math.max(0, ns.getServerMoneyAvailable(targetHostname)
                - (1 - HACK_MONEY_FRACTION) * ns.getServerMaxMoney(targetHostname)));
            return Math.ceil(ns.hackAnalyzeThreads(targetHostname, hackAmount));
        }
    }

    return 0;
}
