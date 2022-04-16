import { NS, SleeveSkills } from '@ns'

const BUDGET_RATIO = 0.01;
const CYCLE_TIME = 60 * 1000;
const MIN_COMBAT_STAT_FOR_HOMICIDE = 80;
const MIN_MONEY_GYM_WORKOUTS = 1e8;
const GYM_NAME = 'Powerhouse Gym';

export async function main(ns : NS) : Promise<void> {
    ns.disableLog('ALL');
    ns.enableLog('print');

    while (true) {
        const numSleeves = ns.sleeve.getNumSleeves();

        if (numSleeves == 0) {
            continue;
        }

        const money = ns.getServerMoneyAvailable('home');
        const budget = money * BUDGET_RATIO / numSleeves;

        for (let sleeveNumber = 0; sleeveNumber < numSleeves; ++sleeveNumber) {
            let sleeveStats = ns.sleeve.getSleeveStats(sleeveNumber);
            purchaseAugs(ns, sleeveNumber, sleeveStats, budget);
            sleeveStats = ns.sleeve.getSleeveStats(sleeveNumber);
            assignTask(ns, sleeveNumber, sleeveStats);
        }

        await ns.sleep(CYCLE_TIME);
    }
}

function purchaseAugs(ns: NS, sleeveNumber: number, sleeveStats: SleeveSkills, budget: number): void {
    if (sleeveStats.shock > 0) {
        return;
    }

    const purchasableAugs = ns.sleeve.getSleevePurchasableAugs(sleeveNumber);
    purchasableAugs.sort((a, b) => a.cost - b.cost );

    for (const aug of purchasableAugs) {
        if (aug.cost > budget) {
            return;
        }

        ns.print(`Buying '${aug.name}' for sleeve ${sleeveNumber} for ${ns.nFormat(aug.cost, '$0.00a')}`);

        if (! ns.sleeve.purchaseSleeveAug(sleeveNumber, aug.name)) {
            ns.print(`ERROR: Failed to buy '${aug.name}' for sleeve ${sleeveNumber}`);
        }
    }
}

function assignTask(ns: NS, sleeveNumber: number, sleeveStats: SleeveSkills): void {
    const minCombatStat = Math.min(
        sleeveStats.agility,
        sleeveStats.defense,
        sleeveStats.dexterity,
        sleeveStats.strength
    );

    if (minCombatStat < MIN_COMBAT_STAT_FOR_HOMICIDE) {
        const money = ns.getServerMoneyAvailable('home');

        if (money > MIN_MONEY_GYM_WORKOUTS) {
            setGymTask(ns, sleeveNumber, sleeveStats);
        } else {
            setCrimeTask(ns, sleeveNumber, 'Mug');
        }
    } else {
        setCrimeTask(ns, sleeveNumber, 'Homicide');
    }
}

function setCrimeTask(ns: NS, sleeveNumber: number, crime: string): void {
    const oldTask = ns.sleeve.getTask(sleeveNumber);

    if (oldTask.crime != crime) {
        ns.print(`Sleeve #${sleeveNumber} will now do crime '${crime}'.`);

        if (! ns.sleeve.setToCommitCrime(sleeveNumber, crime)) {
            ns.print(`ERROR: Failed to set sleeve ${sleeveNumber} to crime '${crime}'.`);
        }
    }
}


function setGymTask(ns: NS, sleeveNumber: number, sleeveStats: SleeveSkills): void {
    let minStatValue = sleeveStats.agility;
    let minStatType = 'Agility';

    if (sleeveStats.defense < minStatValue) {
        minStatValue = sleeveStats.defense;
        minStatType = 'Defense';
    }

    if (sleeveStats.dexterity < minStatValue) {
        minStatValue = sleeveStats.dexterity;
        minStatType = 'Dexterity';
    }

    if (sleeveStats.strength < minStatValue) {
        minStatValue = sleeveStats.strength;
        minStatType = 'Strength';
    }

    const oldTask = ns.sleeve.getTask(sleeveNumber);

    if (oldTask.gymStatType != minStatType) {
        ns.print(`Sleeve #${sleeveNumber} will now work out ${minStatType}.`);

        if (! ns.sleeve.setToGymWorkout(sleeveNumber, GYM_NAME, minStatType)) {
            ns.print(`ERROR: Failed to set sleeve ${sleeveNumber} to work out '${minStatType}'.`);
        }
    }
}
