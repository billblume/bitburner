import { NS } from '@ns'

const GROW_TIME_MULTIPLIER = 3.2;
const WEAKEN_TIME_MULTIPLIER = 4;
const WEAKEN_AMOUNT = 0.05;

export class ServerHackScore {

    hostname: string;
    score: number;
    weakenScore: number;
    maxMoney: number;
    security: number;
    minSecurity: number;
    growThreads: number;
    hackThreads: number;
    weakenThreads: number;
    initialWeakenThreads: number;
    cycleTime: number;
    moneyPerSec: number;

    constructor(ns: NS, hostname: string, totalThreads: number, hackMoneyFraction: number) {
        this.hostname = hostname;

        this.maxMoney = ns.getServerMaxMoney(hostname);
        this.security = ns.getServerSecurityLevel(hostname);
        this.minSecurity = ns.getServerMinSecurityLevel(hostname);
        const timeAdjustment = this.getHackingSkillFactor(ns, hostname, this.minSecurity) / this.getHackingSkillFactor(ns, hostname, this.security);

        const growthAmount = 1 / (1 - hackMoneyFraction);
        this.growThreads = Math.ceil(ns.growthAnalyze(hostname, growthAmount) * timeAdjustment);
        const growCycles =  Math.ceil(this.growThreads / totalThreads);
        const growSecIncrease = ns.growthAnalyzeSecurity(this.growThreads);

        const hackMoneyAdjustment = this.security < 100 ? (100 - this.security) / (100 - this.minSecurity) : 1;
        this.hackThreads = Math.ceil(hackMoneyFraction  * hackMoneyAdjustment / (ns.hackAnalyze(hostname)));
        const hackCycles =  Math.ceil(this.hackThreads / totalThreads);
        const hackSecIncrease = ns.hackAnalyzeSecurity(this.hackThreads);
        const hackTime = ns.getHackTime(hostname) * timeAdjustment / 1000;

        this.weakenThreads = Math.ceil((growSecIncrease + hackSecIncrease) / WEAKEN_AMOUNT);
        this.initialWeakenThreads = Math.ceil((this.security - this.minSecurity) / WEAKEN_AMOUNT);
        // We purposefully don't put a ceiling on the weakens, since we don't always do a weaken for every hack/grow cycle.
        const weakenCycles = this.weakenThreads / totalThreads;

        this.cycleTime = (growCycles * GROW_TIME_MULTIPLIER + hackCycles + weakenCycles * WEAKEN_TIME_MULTIPLIER) * hackTime;
        this.moneyPerSec = Math.floor(this.maxMoney * hackMoneyFraction / this.cycleTime);
        this.score = this.moneyPerSec;
        this.weakenScore = this.maxMoney * (this.security - this.minSecurity) / (100 - this.minSecurity) / hackTime;
    }

    // Taken from https://github.com/danielyxie/bitburner/blob/dev/src/Hacking.ts
    private getHackingSkillFactor(ns: NS, hostname: string, hackDifficulty: number) {
        const difficultyMult = ns.getServerRequiredHackingLevel(hostname) * hackDifficulty;
        const baseDiff = 500;
        const diffFactor = 2.5;
        return diffFactor * difficultyMult + baseDiff;
    }

    toString(ns: NS): string {
        return ns.sprintf(
            '%s: Money: %s (%s/s), Sec: %d/%d, Thr: G:%d/H:%d/W:%d/IW:%d, Cyc Time: %.1fs',
            this.hostname,
            ns.nFormat(this.maxMoney, '$0.00a'),
            ns.nFormat(this.moneyPerSec, '$0.00a'),
            this.security,
            this.minSecurity,
            this.growThreads,
            this.hackThreads,
            this.weakenThreads,
            this.initialWeakenThreads,
            this.cycleTime
        );
    }
}
