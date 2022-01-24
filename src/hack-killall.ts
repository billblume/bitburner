import { NS } from '@ns';
import { getAllServerHostnames } from './lib/server';

export async function main(ns: NS): Promise<void> {
    const hostnames = getAllServerHostnames(ns);
    const agentScripts = ns.ls('home').filter(file => file.startsWith('/agent/'));

    for (const hostname of hostnames) {
        agentScripts.forEach(script => ns.scriptKill(script, hostname));
    }

    return Promise.resolve();
}
