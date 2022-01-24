import { NS, GangGenInfo, EquipmentStats } from '@ns';

const HACKER_EQUIP_TYPES = ['Rootkit', 'Vehicle'];
const COMBAT_EQUIP_TYPES = ['Weapon', 'Armor', 'Vehicle'];
const BUDGET_RATIO = 0.01;
const ASCEND_STAT_MULT_THRESHOLD = 2;
const MEMBER_NAMES = [
    'Alice',
    'Bob',
    'Carol',
    'Dennis',
    'Emily',
    'Frank',
    'Gertrude',
    'Harry',
    'Iris',
    'John',
    'Karen',
    'Larry',
    'Maude',
    'Nero',
    'Olivia',
    'Patrick',
    'Queen',
    'Roger',
    'Sally',
    'Ted',
    'Ulla',
    'Vernon',
    'Wilma',
    'Xavier',
    'Zelda'
];

export async function main(ns: NS): Promise<void> {
    ns.disableLog('ALL');
    ns.enableLog('print');

    for (; ;) {
        const gangInfo = ns.gang.getGangInformation();
        recruitMembers(ns, gangInfo);
        ascendMembers(ns, gangInfo);
        equipMembers(ns, gangInfo);
        await ns.sleep(4000);
    }
}

function recruitMembers(ns: NS, gangInfo: GangGenInfo): void {
    while (ns.gang.canRecruitMember()) {
        const memberNames = ns.gang.getMemberNames();
        let memberName = 'Nobody';

        for (const aMemberName of MEMBER_NAMES) {
            if (!memberNames.includes(aMemberName)) {
                memberName = aMemberName;
                break;
            }
        }

        const success = ns.gang.recruitMember(memberName);

        if (success) {
            ns.print(`Recruited ${memberName}`);

            if (gangInfo.isHacking) {
                ns.gang.setMemberTask(memberName, 'Train Hacking');
            } else {
                ns.gang.setMemberTask(memberName, 'Train Combat');
            }
        } else {
            ns.print(`Failed to recruit ${memberName}`);
            break;
        }
    }
}

function ascendMembers(ns: NS, gangInfo: GangGenInfo): void {
    const memberNames = ns.gang.getMemberNames();
    let ascMemberName = null;
    let ascMemberMult = 1;

    for (const memberName of memberNames) {
        const ascResult = ns.gang.getAscensionResult(memberName);

        if (ascResult) {
            let ascMult;

            if (gangInfo.isHacking) {
                ascMult = ascResult.hack;
            } else {
                ascMult = (ascResult.str + ascResult.def + ascResult.agi + ascResult.dex) / 4;
            }

            if (ascMult > ascMemberMult) {
                ascMemberName = memberName;
                ascMemberMult = ascMult;
            }
        }
    }

    if (ascMemberMult > ASCEND_STAT_MULT_THRESHOLD && ascMemberName !== null) {
        ns.gang.ascendMember(ascMemberName);
        ns.print(`Ascended ${ascMemberName}`);
    }
}

function equipMembers(ns: NS, gangInfo: GangGenInfo): void {
    const money = ns.getServerMoneyAvailable('home');
    const memberNames = ns.gang.getMemberNames();
    const budget = money * BUDGET_RATIO / memberNames.length;
    const equipNames = ns.gang.getEquipmentNames();
    const equipCost: Record<string, number> = {};
    const equipType: Record<string, string> = {};
    const equipStats: Record<string, EquipmentStats> = {};

    for (const equipName of equipNames) {
        equipCost[equipName] = ns.gang.getEquipmentCost(equipName);
        equipType[equipName] = ns.gang.getEquipmentType(equipName);
        equipStats[equipName] = ns.gang.getEquipmentStats(equipName);
    }

    equipNames.sort((a, b) => equipCost[a] - equipCost[b]);

    for (const memberName of memberNames) {
        const memberInfo = ns.gang.getMemberInformation(memberName);
        let memberBudget = budget;

        for (const equipName of memberInfo.upgrades) {
            memberBudget -= equipCost[equipName] ?? 0;
        }

        for (const equipName of equipNames) {
            const type = equipType[equipName];

            if (type == 'Augmentation') {
                if (memberInfo.augmentations.includes(equipName)) {
                    continue;
                }

                const stats = equipStats[equipName];
                const isHackAug = ('hack' in stats) && stats.hack && stats.hack > 1;

                if (gangInfo.isHacking && !isHackAug) {
                    continue;
                } else if (!gangInfo.isHacking && isHackAug) {
                    continue;
                }
            } else {
                if (memberInfo.upgrades.includes(equipName)) {
                    continue;
                }

                if (gangInfo.isHacking) {
                    if (!HACKER_EQUIP_TYPES.includes(type)) {
                        continue;
                    }
                } else {
                    if (!COMBAT_EQUIP_TYPES.includes(type)) {
                        continue;
                    }
                }
            }

            const cost = equipCost[equipName];

            if (cost > memberBudget) {
                continue;
            }

            const success = ns.gang.purchaseEquipment(memberName, equipName);

            if (success) {
                ns.print(`Purchased '${equipName}' for ${memberName}`);
                memberBudget -= cost;
            } else {
                ns.print(`Failed to purchase '${equipName}' for ${memberName}`);
            }
        }
    }
}
