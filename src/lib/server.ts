import { NS } from '@ns';

export function getAllServerHostnames(ns: NS): string[] {
    const queue = ['home'];
    const servers: string[] = [];

    while (queue.length > 0) {
        const hostname = queue.shift();

        if (hostname == undefined) {
            break;
        }

        servers.push(hostname);
        const childHosts = ns.scan(hostname);

        for (const childHost of childHosts) {
            if (!queue.includes(childHost) && !servers.includes(childHost)) {
                queue.push(childHost);
            }
        }
    }

    return servers;
}
