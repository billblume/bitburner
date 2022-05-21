import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
    while (minCombatStat(ns) < 50) {
        const time = ns.singularity.commitCrime('Mug someone');
        await ns.sleep(time);
    }

    while (true) {
        const time = ns.singularity.commitCrime('Homicide');
        await ns.sleep(time);
    }
}

function minCombatStat(ns: NS) {
    const player = ns.getPlayer();
    return Math.min(
        player.agility,
        player.dexterity,
        player.strength,
        player.defense
    );
}
