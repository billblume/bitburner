import { NS } from '@ns'

const GYM = 'powerhouse gym';

export async function main(ns : NS) : Promise<void> {
    while (true) {
        const player = ns.getPlayer();
        const str = player.strength;
        const def = player.defense;
        const agi = player.agility;
        const dex = player.dexterity;
        let stat;

        if (str <= def && str <= agi && str <= dex) {
            stat = 'strength';
        } else if (def <= agi && def <= dex) {
            stat = 'defense';
        } else if (agi <= dex) {
            stat = 'agility';
        } else {
            stat = 'dexterity';
        }

        const success = ns.singularity.gymWorkout(GYM, stat, true);

        if (! success) {
            return;
        }

        await ns.sleep(30000);
    }
}
