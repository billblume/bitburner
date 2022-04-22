import { NS } from '@ns'
import { getAllServerHostnames } from '/lib/server';
import { ServerHackStats } from '/lib/ServerHackStats';

const WEAKEN_LOWER_THRESHOLD = 0.95;
const WEAKEN_UPPER_THRESHOLD = 1;
const GROW_LOWER_THRESHOLD = 0.75;
const GROW_UPPER_THRESHOLD = 0.9;
const RESERVED_HOME_RAM = 192;
const RESERVED_HOME_RAM_WITH_CORP = 1200;
const HACKNET_RAM_SCRIPTING_FRACTION = 0.5;
const HACK_MONEY_FRACTION = 0.5;
const PRINT_JOB_INFO = false;

const AGENT_SCRIPTS = [
    '/agent/grow.js',
    '/agent/hack.js',
    '/agent/weaken.js'
];

export interface ServerThreads {
    hostname: string;
    threads: number;
}

interface AllServerInfo {
    [hostname: string]: ServerInfo
}

interface ServerInfo {
    hostname: string;
    rooted: boolean;
    lastAction: string;
    maxThreads: number;
    usedThreads: number;
    availableMoney: number;
    stats: ServerHackStats;
}

interface Job {
    targetHostname: string;
    action: string;
    allocatedServers: ServerThreads[];
    threads: number;
    time: number;
    remainingTime: number;
}

export class ServerHackScheduler {
    ns: NS;
    servers: AllServerInfo;
    serversToHack: ServerThreads[];
    runningJobs: Job[];

    constructor(ns: NS) {
        this.ns = ns;
        this.servers = {};
        this.serversToHack = [];
        this.runningJobs = [];
        this.initServerInfo();
    }

    private initServerInfo() {
        this.servers = {};
        const allHostnames = getAllServerHostnames(this.ns);

        for (const hostname of allHostnames) {
            this.servers[hostname] = {
                hostname: hostname,
                rooted: false,
                lastAction: 'none',
                maxThreads: 0,
                usedThreads: 0,
                availableMoney: 0,
                stats: new ServerHackStats(hostname)
            }
        }
    }

    async updateServerInfo(): Promise<void> {
        let agentMaxRam = 0;

        for (const agent of AGENT_SCRIPTS) {
            agentMaxRam = Math.max(agentMaxRam, this.ns.getScriptRam(agent));
        }

        for (const hostname in this.servers) {
            const serverInfo = this.servers[hostname];

            if (! serverInfo.rooted) {
                if (! this.ns.hasRootAccess(hostname)) {
                    continue;
                }

                serverInfo.rooted = true;
                await this.ns.scp(AGENT_SCRIPTS, 'home', hostname);
            }

            const ram = this.getServerAvailableRam(hostname);
            serverInfo.maxThreads = Math.floor(ram / agentMaxRam);
        }
    }

    killAllAgents() {
        for (const hostname in this.servers) {
            const serverInfo = this.servers[hostname];

            if (! serverInfo.rooted || serverInfo.maxThreads <= 0) {
                continue;
            }

            for (const agent of AGENT_SCRIPTS) {
                this.ns.scriptKill(agent, hostname);
            }
        }
    }

    private getServerAvailableRam(hostname: string): number {
        let ram = this.ns.getServerMaxRam(hostname);

        if (hostname == 'home') {
            const player = this.ns.getPlayer();

            if (player.hasCorporation) {
                ram = Math.max(0, ram - RESERVED_HOME_RAM_WITH_CORP);
            } else {
                ram = Math.max(0, ram - RESERVED_HOME_RAM);
            }
        } else if (hostname.startsWith('hacknet-node-')) {
            ram = Math.floor(ram * HACKNET_RAM_SCRIPTING_FRACTION);
        }

        return ram;
    }

    getTotalThreads(): number {
        let threads = 0;

        for (const hostname in this.servers) {
            const serverInfo = this.servers[hostname];
            threads += serverInfo.maxThreads;
        }

        return threads;
    }

    getAvailableThreads(): number {
        let threads = 0;

        for (const hostname in this.servers) {
            const serverInfo = this.servers[hostname];
            threads += serverInfo.maxThreads - serverInfo.usedThreads;
        }

        return threads;
    }

    setServersToHack(servers: ServerThreads[]): void {
        this.serversToHack = servers;
    }

    async runOneCycle(): Promise<void> {
        this.scheduleUnassignedJobs();
        await this.waitForNextJob();
    }

    private scheduleUnassignedJobs() {
        for (const serverToHack of this.serversToHack) {
            let isRunning = false;

            for (const job of this.runningJobs) {
                if (job.targetHostname === serverToHack.hostname) {
                    isRunning = true;
                    break;
                }
            }

            if (isRunning) {
                continue;
            }

            if (this.getAvailableThreads() <= 0) {
                return;
            }

            const serverInfo = this.servers[serverToHack.hostname];
            const action = this.getNextAction(serverInfo.lastAction, serverToHack.hostname);
            const threads = Math.min(this.getActionThreads(action, serverToHack.hostname), serverToHack.threads);
            this.scheduleJob(action, serverToHack.hostname, threads);
        }
    }

    private getNextAction(lastAction: string,targetHostname: string): string {
        const securityLevel = this.ns.getServerSecurityLevel(targetHostname);
        const hackFactor = Math.max(0, 100 - securityLevel);
        const minSecurityLevel = this.ns.getServerMinSecurityLevel(targetHostname);
        const hackMaxFactor = Math.max(0, 100 - minSecurityLevel);
        const maxMoney = this.ns.getServerMaxMoney(targetHostname);
        const money = this.ns.getServerMoneyAvailable(targetHostname);

        if (lastAction == 'weaken' && hackFactor < hackMaxFactor * WEAKEN_UPPER_THRESHOLD) {
            return 'weaken';
        } else if (hackFactor < hackMaxFactor * WEAKEN_LOWER_THRESHOLD) {
            return 'weaken';
        } else if (lastAction == 'grow' && money < maxMoney * GROW_UPPER_THRESHOLD) {
            return 'grow';
        } else if (money < maxMoney * GROW_LOWER_THRESHOLD) {
            return 'grow';
        } else {
            return 'hack';
        }
    }

    private getActionThreads(action: string, targetHostname: string): number {
        switch (action) {
            case 'grow': {
                const maxMoney = this.ns.getServerMaxMoney(targetHostname);
                const moneyAvailable = this.ns.getServerMoneyAvailable(targetHostname);

                if (moneyAvailable > 0) {
                    const growAmount = maxMoney / moneyAvailable;
                    return Math.ceil(this.ns.growthAnalyze(targetHostname, growAmount));
                } else {
                    return 1000000000;
                }
            }

            case 'weaken':
                return 1000000000;

            case 'hack': {
                const hackAmount = Math.ceil(Math.max(0, this.ns.getServerMoneyAvailable(targetHostname)
                    - (1 - HACK_MONEY_FRACTION) * this.ns.getServerMaxMoney(targetHostname)));
                return Math.ceil(this.ns.hackAnalyzeThreads(targetHostname, hackAmount));
            }
        }

        return 0;
    }

    private scheduleJob(action: string, targetHostname: string, threads: number) {
        const availServers = Object.keys(this.servers)
            .map(hostname => this.servers[hostname])
            .filter(serverInfo => serverInfo.maxThreads > 0)
            .sort((a, b) => (b.maxThreads - b.usedThreads) - (a.maxThreads - a.usedThreads));
        const allocatedServers = [];
        let script = '';
        let runTime = 0;
        let remainingThreads = threads;

        switch (action) {
            case 'grow':
                script = '/agent/grow.js';
                runTime =  this.ns.getGrowTime(targetHostname) / 1000;
                break;

            case 'weaken':
                script = '/agent/weaken.js';
                runTime =  this.ns.getWeakenTime(targetHostname) / 1000;
                break;

            case 'hack':
                script = '/agent/hack.js'
                runTime =  this.ns.getHackTime(targetHostname) / 1000;
                break;
        }

        for (const serverInfo of availServers) {
            if (remainingThreads <= 0) {
                break;
            }

            const availThreads = serverInfo.maxThreads - serverInfo.usedThreads;

            if (availThreads <= 0) {
                continue;
            }

            const serverThreads = Math.min(availThreads, remainingThreads);

            if (this.ns.exec(script, serverInfo.hostname, serverThreads, targetHostname)) {
                serverInfo.usedThreads += serverThreads;
                remainingThreads -= serverThreads;
                allocatedServers.push({
                    hostname: serverInfo.hostname,
                    threads: serverThreads
                });
            } else {
                const usedRam = this.ns.getServerUsedRam(targetHostname);
                const maxRam = this.ns.getServerMaxRam(targetHostname);
                this.ns.print(`Error running script '${script} ${targetHostname}' on ${serverInfo.hostname} with ${serverThreads} threads.` +
                    `  (Used ${usedRam}GB, Max ${maxRam}GB)`);
            }
        }

        this.runningJobs.push({
            targetHostname: targetHostname,
            action: action,
            allocatedServers: allocatedServers,
            threads: threads - remainingThreads,
            time: runTime,
            remainingTime: runTime
        })

        const targetServerInfo = this.servers[targetHostname];
        targetServerInfo.availableMoney = this.ns.getServerMoneyAvailable(targetHostname);
    }

    private async waitForNextJob(): Promise<void> {
        const minRemainingTime = this.runningJobs.reduce<number>((time, job) => Math.min(time, job.remainingTime), 300);
        await this.ns.sleep(minRemainingTime * 1000 + 100);
        const newRunningJobs: Job[] = [];

        for (const job of this.runningJobs) {
            job.remainingTime = Math.max(job.remainingTime - minRemainingTime, 0);

            if (job.remainingTime > 0) {
                newRunningJobs.push(job);
            } else {
                for (const server of job.allocatedServers) {
                    const allocServerInfo = this.servers[server.hostname];
                    allocServerInfo.usedThreads = Math.max(allocServerInfo.usedThreads - server.threads, 0);
                }

                const targetServerInfo = this.servers[job.targetHostname];
                targetServerInfo.lastAction = job.action;
                targetServerInfo.stats.addTime(job.action, job.time);

                if (job.action == 'hack') {
                    const extractedMoney = targetServerInfo.availableMoney - this.ns.getServerMoneyAvailable(job.targetHostname);
                    targetServerInfo.stats.addMoney(extractedMoney);
                }

                if (PRINT_JOB_INFO) {
                    this.ns.print(this.ns.sprintf(
                        '%s %s %dx%.1fs: %s',
                        job.action,
                        job.targetHostname,
                        job.threads,
                        job.time,
                        targetServerInfo.stats.toString(this.ns)
                    ));
                }
             }
        }

        this.runningJobs = newRunningJobs;
    }

    printStats(): void {
        const moneyPerSec = (serverInfo: ServerInfo): number => {
            const totalTime = serverInfo.stats.growTime + serverInfo.stats.hackTime + serverInfo.stats.weakenTime;
            return totalTime > 0 ? serverInfo.stats.extractedMoney / totalTime : 0;
        };
        Object.keys(this.servers)
            .map(hostname => this.servers[hostname])
            .filter(serverInfo => serverInfo.stats.cycles > 0)
            .sort((a, b) => moneyPerSec(b) - moneyPerSec(a))
            .forEach(serverInfo => {
                this.ns.print(`INFO: Act: ${serverInfo.hostname}: Cycs: ${serverInfo.stats.cycles} ` + serverInfo.stats.toSummaryString(this.ns));
            });
    }
}
