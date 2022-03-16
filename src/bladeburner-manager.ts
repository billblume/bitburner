import { NS } from '@ns'

const STAMINA_LOW = 0.5;
const STAMINA_HIGH = 0.95;
const CHAOS_LOW = 25;
const CHAOS_HIGH = 50;
const POPULATION_REALLY_LOW = 1e6;
const POPULATION_LOW = 1e8;
const POPULATION_HIGH = 1e9;
const MIN_SUCCESS_CHANCE_SPREAD = 0.95;
const MIN_CONTRACT_SUCCESS_CHANCE = 0.5;
const MIN_OPERATION_SUCCESS_CHANCE = 0.6;
const MIN_BLACK_OP_SUCCESS_CHANCE = 0.9;
const OVERCLOCK_LEVELING_THRESHOLD = 30;
const SKILL_OVERCLOCK = 'Overclock';
const CITY_SWITCH_THRESHOLD = 0.5;

const CITIES = [
    'Aevum',
    'Chongqing',
    'Ishima',
    'New Tokyo',
    'Sector-12',
    'Volhaven'
];

enum Action {
    Training = "Training",
    FieldAnalysis = "Field Analysis",
    Diplomacy = "Diplomacy",
    Hospital = "Hyperbolic Regeneration Chamber",
    InciteViolence = "Incite Violence",

    Tracking = "Tracking",
    BountyHunter = "Bounty Hunter",
    Retirement = "Retirement",

    Investigation = "Investigation",
    Undercover = "Undercover Operation",
    Sting = "Sting Operation",
    Raid = "Raid",
    StealthRetirement = "Stealth Retirement Operation",
    Assassination = "Assassination"
}

enum ActionType {
    General = "General",
    Contracts = "Contracts",
    Operations = "Operations",
    BlackOps = "BlackOps"
}

interface IAction {
    type: ActionType,
    name: string
}

export async function main(ns : NS) : Promise<void> {
    ns.disableLog('ALL');
    ns.enableLog('print');
    let lastAction: IAction = { type: ActionType.General, name: Action.Hospital };

    while (true) {
        buySkills(ns);
        switchCity(ns);
        const action = selectAction(ns, lastAction);
        const actionTime = ns.bladeburner.getActionTime(action.type, action.name);
        // ns.print(`Running action '${action.type}: ${action.name}'`);
        const success = ns.bladeburner.startAction(action.type, action.name);

        if (! success) {
            ns.tprint(`ERROR Unable to start action '${action.type}: ${action.name}'`);
            return;
        }

        await ns.sleep(actionTime);
        lastAction = action;
    }
}

function buySkills(ns: NS): void {
    const maxSkillLevel = getMaxSkillLevel(ns);
    let overclockLevel = ns.bladeburner.getSkillLevel(SKILL_OVERCLOCK);

    if (maxSkillLevel >= OVERCLOCK_LEVELING_THRESHOLD && overclockLevel < 90) {
        while(ns.bladeburner.getSkillUpgradeCost(SKILL_OVERCLOCK) <= ns.bladeburner.getSkillPoints()) {
            overclockLevel = ns.bladeburner.getSkillLevel(SKILL_OVERCLOCK);

            if (overclockLevel >= 90) {
                break;
            }

            const cost = ns.bladeburner.getSkillUpgradeCost(SKILL_OVERCLOCK);
            ns.print(`Upgrading '${SKILL_OVERCLOCK} to level ${overclockLevel + 1} for ${cost} points.`);
            const status = ns.bladeburner.upgradeSkill(SKILL_OVERCLOCK);

            if (! status) {
                ns.print(`ERROR failed to upgrade skill ${SKILL_OVERCLOCK}`);
                return;
            }
        }

        return;
    }

    while (true) {
        const skill = getCheapestSkill(ns);

        if (! skill) {
            return;
        }

        const level = ns.bladeburner.getSkillLevel(skill) + 1;
        const cost = ns.bladeburner.getSkillUpgradeCost(skill);
        ns.print(`Upgrading '${skill}' to level ${level} for ${cost} points.`);
        const status = ns.bladeburner.upgradeSkill(skill);

        if (! status) {
            ns.print(`ERROR failed to upgrade skill ${skill}`);
            return;
        }
    }
}

function getMaxSkillLevel(ns: NS): number {
    return ns.bladeburner.getSkillNames()
        .reduce((prevLevel, name) => Math.max(prevLevel, ns.bladeburner.getSkillLevel(name)), 0);
}

function getCheapestSkill(ns: NS): string|null {
    const points = ns.bladeburner.getSkillPoints();

    const skillCosts = ns.bladeburner.getSkillNames()
        .map(name => { return { name: name, cost: ns.bladeburner.getSkillUpgradeCost(name) * getSkillWeight(ns, name) }; })
        .filter(nameCost => nameCost.cost <= points)
        .filter(nameCost => nameCost.name != SKILL_OVERCLOCK || ns.bladeburner.getSkillLevel(SKILL_OVERCLOCK) < 90)
        .sort((a, b) => a.cost - b.cost);

    if (skillCosts.length > 0) {
        return skillCosts[0].name;
    }

    return null;
}

function getSkillWeight(ns: NS, skill: string): number {
    const level = ns.bladeburner.getSkillLevel(skill);

    switch (skill) {
        case "Blade's Intuition":
        case "Digital Observer":
        case "Reaper":
        case "Evasive System":
            return 1;


        case "Cloak":
        case "Short-Circuit":
            if (level < 25) {
                return 1;
            }

            return 2;


        case "Tracer":
            if (level < 10) {
                return 1;
            }

            return 4;

        case "Overclock":
        case "Hyperdrive":
            return 2;

        default:
            return 4;
    }
}

function switchCity(ns: NS): void {
    const currentCity = ns.bladeburner.getCity();
    let mostPopulatedCity = null;
    let mostPopulatedCityPop = 0;

    for (const city of CITIES) {
        const estPop = ns.bladeburner.getCityEstimatedPopulation(city);

        if (estPop > mostPopulatedCityPop) {
            mostPopulatedCity = city;
            mostPopulatedCityPop = estPop;
        }
    }

    if (! mostPopulatedCity) {
        return;
    }

    const currentCityPop = ns.bladeburner.getCityEstimatedPopulation(currentCity);

    if (currentCityPop < mostPopulatedCityPop * CITY_SWITCH_THRESHOLD) {
        ns.print(`Switching to city ${mostPopulatedCity}`);
        const success = ns.bladeburner.switchCity(mostPopulatedCity);

        if (! success) {
            ns.print(`ERROR Failed to switch to city ${mostPopulatedCity}`);
        }
    }
}

function selectAction(ns: NS, lastAction: IAction): IAction {
    const stamina = ns.bladeburner.getStamina();
    const percentStamina = stamina[0] / stamina[1];

    if (percentStamina < STAMINA_LOW) {
        ns.print(`Picking ${Action.Hospital} because stamina is low.`);
        return { type: ActionType.General, name: Action.Hospital };
    }

    if (percentStamina < STAMINA_HIGH && lastAction.name == Action.Hospital) {
        ns.print(`Picking ${Action.Hospital} because stamina is low.`);
        return { type: ActionType.General, name: Action.Hospital };
    }

    const city = ns.bladeburner.getCity();
    const chaos = ns.bladeburner.getCityChaos(city);

    if (chaos > CHAOS_HIGH) {
        ns.print(`Picking ${Action.Diplomacy} because chaos is high.`);
        return { type: ActionType.General, name: Action.Diplomacy };
    }

    if (chaos > CHAOS_LOW && lastAction.name == Action.Diplomacy) {
        ns.print(`Picking ${Action.Diplomacy} because chaos is high.`);
        return { type: ActionType.General, name: Action.Diplomacy };
    }

    const blackOpAction = getBlackOpAction(ns);

    if (blackOpAction) {
        ns.print(`Picking BlackOps ${blackOpAction.name}.`);
        return blackOpAction;
    }

    const estPop = ns.bladeburner.getCityEstimatedPopulation(city);
    const assassinationSuccessChance =
        ns.bladeburner.getActionEstimatedSuccessChance(ActionType.Operations, Action.Assassination);
    const highSpread = assassinationSuccessChance[1] > 0 &&
        assassinationSuccessChance[0] / assassinationSuccessChance[1] < MIN_SUCCESS_CHANCE_SPREAD;

    if (estPop >= POPULATION_REALLY_LOW && highSpread) {
        ns.print(`Picking ${Action.FieldAnalysis} because success chance spread is too large.`);
        return { type: ActionType.General, name: Action.FieldAnalysis };
    }

    let growPop = false;

    if (estPop < POPULATION_LOW) {
        growPop = true;
    }

    if (
        estPop < POPULATION_HIGH &&
        (
            lastAction.name == Action.FieldAnalysis ||
            lastAction.name == Action.Tracking ||
            lastAction.name == Action.Investigation ||
            lastAction.name == Action.Undercover
        )
    ) {
        growPop = true;
    }

    if (growPop) {
        const bestAction = getBestAction(ns, [
            { type: ActionType.Operations, name: Action.Undercover },
            { type: ActionType.Operations, name: Action.Investigation },
            { type: ActionType.Contracts, name: Action.Tracking }
        ]);

        if (bestAction) {
            ns.print(`Picking ${bestAction.name} because population is low.`);
            return bestAction;
        }

        ns.print(`Picking ${Action.FieldAnalysis} because population is low.`);
        return  { type: ActionType.General, name: Action.FieldAnalysis };
    }

    const allContractsAndOps = [
        { type: ActionType.Operations, name: Action.Assassination },
        { type: ActionType.Operations, name: Action.StealthRetirement },
        { type: ActionType.Operations, name: Action.Raid },
        { type: ActionType.Operations, name: Action.Sting },
        { type: ActionType.Operations, name: Action.Undercover },
        { type: ActionType.Operations, name: Action.Investigation },
        { type: ActionType.Contracts, name: Action.BountyHunter },
        { type: ActionType.Contracts, name: Action.Retirement },
        { type: ActionType.Contracts, name: Action.Tracking }
    ];

    const bestAction = getBestAction(ns, allContractsAndOps);

    if (bestAction) {
        ns.print(`Picking action ${bestAction.name}.`);
        return bestAction;
    }

    const bestActionIgnoringCounts = getBestAction(ns, allContractsAndOps, false);

    if (bestActionIgnoringCounts) {
        ns.print(`Picking ${Action.InciteViolence} because there are no available contracts.`);
        return { type: ActionType.General, name: Action.InciteViolence };
    }

    ns.print(`Picking ${Action.Training} because there is nothing better to do.`);
    return { type: ActionType.General, name: Action.Training };
}

function getBestAction(ns: NS, actions: IAction[], filterZeroCounts = true): IAction|null {
    const city = ns.bladeburner.getCity();
    const estPop = ns.bladeburner.getCityEstimatedPopulation(city);
    const isLowPop = estPop < POPULATION_LOW
    const doableActions = actions
        .filter(action => ! filterZeroCounts || ns.bladeburner.getActionCountRemaining(action.type, action.name) > 0)
        .filter(action => action.name != Action.Raid || ns.bladeburner.getCityCommunities(city) > 0)
        .map(action => {
            const successChance = ns.bladeburner.getActionEstimatedSuccessChance(action.type, action.name);
            const repGain = ns.bladeburner.getActionRepGain(action.type, action.name, 1);
            const time = ns.bladeburner.getActionTime(action.type, action.name);
            const avgSuccess = (successChance[0] + successChance[1]) / 2;
            const score = repGain * avgSuccess / time;
            return {
                type: action.type,
                name: action.name,
                minSuccess: successChance[0],
                avgSuccess: avgSuccess,
                score: score
            };
        })
        .filter(actionInfo => {
            if (isLowPop) {
                if (actionInfo.type == ActionType.Operations) {
                    return actionInfo.avgSuccess >= MIN_OPERATION_SUCCESS_CHANCE;
                } else {
                    return actionInfo.avgSuccess >= MIN_CONTRACT_SUCCESS_CHANCE;
                }
            } else {
                if (actionInfo.type == ActionType.Operations) {
                    return actionInfo.minSuccess >= MIN_OPERATION_SUCCESS_CHANCE;
                } else {
                    return actionInfo.minSuccess >= MIN_CONTRACT_SUCCESS_CHANCE;
                }
            }
        })
        .sort((a, b) => b.score - a.score);

    if (doableActions.length > 0) {
        return { type: doableActions[0].type, name: doableActions[0].name };
    }

    return null;
}

function getBlackOpAction(ns: NS): IAction|null {
    const blackOpNames = ns.bladeburner.getBlackOpNames();
    const doableBlackOps = blackOpNames
        .filter(name => ns.bladeburner.getActionCountRemaining(ActionType.BlackOps, name) > 0)
        .sort((a, b) => ns.bladeburner.getBlackOpRank(a) - ns.bladeburner.getBlackOpRank(b));

    if (doableBlackOps.length == 0) {
        return null;
    }

    const nextBlackOps = doableBlackOps[0];
    const rank = ns.bladeburner.getRank();

    if (ns.bladeburner.getBlackOpRank(nextBlackOps) > rank) {
        return null;
    }

    const successChance = ns.bladeburner.getActionEstimatedSuccessChance(ActionType.BlackOps, nextBlackOps);

    if (successChance[0] < MIN_BLACK_OP_SUCCESS_CHANCE) {
        return null;
    }

    return { type: ActionType.BlackOps, name: nextBlackOps };
}
