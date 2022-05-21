import { NS } from '@ns';
import { getAllServerHostnames } from './lib/server';
import { canCrackServer, crackServer } from './lib/crack';

export async function main(ns: NS): Promise<void> {
    const hostnames = getAllServerHostnames(ns);

    for (const hostname of hostnames) {
        if (canCrackServer(ns, hostname)) {
            ns.tprint(`Cracking ${hostname}`);
            crackServer(ns, hostname);
        }

        if (canBackdoor(ns, hostname)) {
            ns.tprint(`Backdooring ${hostname}`);
            await backdoor(ns, hostname);
        }
    }

    ns.tprint('Done');
}

function canBackdoor(ns: NS, hostname: string): boolean {
    if (!ns.hasRootAccess(hostname)) {
        return false;
    }

    if (ns.getServerRequiredHackingLevel(hostname)
        > ns.getHackingLevel()) {
        return false;
    }

    if (hostname == 'home' || hostname.startsWith('pserv-') || hostname.startsWith('hacknet-node-')) {
        return false;
    }

    const serverInfo = ns.getServer(hostname);

    if (serverInfo.backdoorInstalled) {
        return false;
    }

    return true;
}

async function backdoor(ns: NS, hostname: string):  Promise<void> {
    connect(ns, hostname);
    await ns.singularity.installBackdoor();
    ns.singularity.connect('home');
}

function connect(ns: NS, targetHostname: string): void {
    const queue = ['home'];
    const parent: Record<string,string|null> = { home: null };

    while (queue.length > 0) {
        const hostname = queue.shift();

        if (hostname) {
            ns.scan(hostname).forEach(childHost => {
                if (!(childHost in parent)) {
                    parent[childHost] = hostname;
                    queue.push(childHost);
                }
            });
        }
    }

    let hostname: string|null = targetHostname;
    const path: string[] = [];

    while (hostname && hostname in parent) {
        path.unshift(hostname);
        hostname = parent[hostname];
    }

    if (path.length == 0) {
        ns.tprint(`Could not determine path to ${targetHostname}`);
        return;
    }

    for (const hostname of path) {
        const success = ns.singularity.connect(hostname);

        if (!success) {
            ns.tprint(`Unable to connect to server: ${hostname}`);
            return;
        }
    }
}
