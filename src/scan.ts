import { NS } from '@ns'

interface ChildHostnames {
    [parent: string]: string[]
}

export async function main(ns : NS) : Promise<void> {
     const queue = ['home'];
    const children: ChildHostnames = {};
    children['home'] = [];

    while (queue.length > 0) {
        const hostname = queue.shift();

        if (hostname) {
            ns.scan(hostname)
                .filter(childHost => ! childHost.startsWith('pserv-'))
                .filter(childHost => ! childHost.startsWith('hacknet-node-'))
                .forEach(childHost => {
                    if (!(childHost in children)) {
                        children[hostname].push(childHost);
                        children[childHost] = [];
                        queue.push(childHost);
                    }
                });
        }
    }

    for (const child of children['home']) {
        printChildren(ns, child, children, 0);
    }

    return Promise.resolve();
}

function printChildren(ns: NS, hostname: string, children: ChildHostnames, level: number): void
{
    const numPorts = ns.getServerNumPortsRequired(hostname);
    const secLevel = ns.getServerSecurityLevel(hostname);
    const minSecLevel = ns.getServerMinSecurityLevel(hostname);
    const availMoney = ns.getServerMoneyAvailable(hostname);
    const maxMoney = ns.getServerMaxMoney(hostname);
    const maxRam = ns.getServerMaxRam(hostname);
    const hackLevel = ns.getServerRequiredHackingLevel(hostname);
    const growth = ns.getServerGrowth(hostname);
    const rooted = ns.hasRootAccess(hostname);
    const indent = '  '.repeat(level);
    const prefix = rooted ? '        ' : 'WARNING ';

    ns.tprint(`${prefix}${indent}${hostname}: ${maxRam}GB, ${ns.nFormat(availMoney, '$0.00a')}/${ns.nFormat(maxMoney, '$0.00a')} ${rooted ? '(ROOTED)' : ''}`);
    ns.tprint(`INFO    ${indent}  . Security: ${ns.nFormat(secLevel, '0.0a')}/${ns.nFormat(minSecLevel, '0.0a')}, Ports: ${numPorts}, Min Hack: ${hackLevel}, Growth: ${growth}`);

    for (const child of children[hostname]) {
        printChildren(ns, child, children, level+1);
    }
}
