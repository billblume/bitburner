import { NS } from '@ns'

export class ServerHackStats {
    hostname: string;
    cycles: number;
    growTime: number;
    hackTime: number;
    weakenTime: number;
    chargeTime: number;
    extractedMoney: number;

    constructor(hostname: string) {
        this.hostname = hostname;
        this.cycles = 0;
        this.growTime = 0;
        this.hackTime = 0;
        this.weakenTime = 0;
        this.chargeTime = 0;
        this.extractedMoney = 0;
    }

    addTime(action: string, time: number): void {
        this.cycles += 1;

        switch (action) {
            case 'grow':
                this.growTime += time;
                break;

            case 'hack':
                this.hackTime += time;
                break;

            case 'weaken':
                this.weakenTime += time;
                break;

            case 'charge':
                this.chargeTime += time;
                break;
            }
    }

    addMoney(money: number): void {
        this.extractedMoney += money;
    }

    toString(ns: NS): string {
        const totalTime = this.growTime + this.hackTime + this.weakenTime + this.chargeTime;
        const availMoney = ns.getServerMoneyAvailable(this.hostname);
        const maxMoney = ns.getServerMaxMoney(this.hostname);
        const minSecLevel = ns.getServerMinSecurityLevel(this.hostname);
        const secLevel = ns.getServerSecurityLevel(this.hostname);
        const moneyPerSec = totalTime > 0 ? this.extractedMoney / totalTime : 0;

        return ns.sprintf(
            'Times: %.1fs (G%02d/H%02d/W%02d).'
            + ' Money: %s (%s/s, A%s/M%s).'
            + ' Sec: %d/%d.',
            totalTime,
            this.growTime * 100 / totalTime,
            this.hackTime * 100 / totalTime,
            this.weakenTime * 100 / totalTime,
            ns.nFormat(this.extractedMoney, '$0.00a'),
            ns.nFormat(moneyPerSec, '$0.00a'),
            ns.nFormat(availMoney, '$0.00a'),
            ns.nFormat(maxMoney, '$0.00a'),
            secLevel,
            minSecLevel
        );
    }

    toSummaryString(ns: NS): string {
        const totalTime = this.growTime + this.hackTime + this.weakenTime + this.chargeTime;
        const moneyPerSec = totalTime > 0 ? this.extractedMoney / totalTime : 0;

        return ns.sprintf(
            'Money: %s (%s/s).  Times: %.1fs (G%02d/H%02d/W%02d).',
            ns.nFormat(this.extractedMoney, '$0.00a'),
            ns.nFormat(moneyPerSec, '$0.00a'),
            totalTime,
            this.growTime * 100 / totalTime,
            this.hackTime * 100 / totalTime,
            this.weakenTime * 100 / totalTime,
        );
    }
}
