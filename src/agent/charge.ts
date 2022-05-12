import { NS } from '@ns'

export async function main(ns : NS) : Promise<void> {
    for (let i = 0; i < ns.args.length; i += 2) {
        const rootX = Number(ns.args[i]);
        const rootY = Number(ns.args[i + 1] || 0);
        await ns.stanek.chargeFragment(rootX, rootY);
    }
}
