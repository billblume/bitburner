import { NS } from '@ns';

export async function main(ns: NS): Promise<void> {
    const hostname = String(ns.args[0]);
    await ns.weaken(hostname);
}
