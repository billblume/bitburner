import { NS } from '@ns';
import { getAllServerHostnames } from './lib/server';

const WEAKEN_SCRIPT = 'agent-weaken.js';
const TARGET_HOSTNAME = 'joesguns';

export async function main(ns: NS): Promise<void> {
    ns.disableLog('ALL');
    ns.enableLog('print');
    const serverHostnames = getAllServerHostnames(ns);
    let iteration = 0;

    while (true) {
        const farmableHostnames = [];

        for (const hostname of serverHostnames) {
            if (
                hostname != 'home'
                && ns.hasRootAccess(hostname)
                && ns.getServerMaxRam(hostname) >= 4
            ) {
                farmableHostnames.push(hostname);
            }
        }

        const weakenTime = ns.getWeakenTime(TARGET_HOSTNAME) / 1000;
        let totalThreads = 0;

        for (const hostname of farmableHostnames) {
            const scriptRam = ns.getScriptRam(WEAKEN_SCRIPT, hostname);

            if (scriptRam > 0) {
                const serverThreads = Math.floor(ns.getServerMaxRam(hostname) / scriptRam);
                totalThreads += serverThreads;
            }
        }

        ns.print(ns.sprintf(
            '%d weaken %dx%.1fs',
            iteration,
            totalThreads,
            weakenTime,
        ));

        for (const hostname of farmableHostnames) {
            const scriptRam = ns.getScriptRam(WEAKEN_SCRIPT, hostname);

            if (scriptRam > 0) {
                const serverThreads = Math.floor(ns.getServerMaxRam(hostname) / scriptRam);
                ns.exec(WEAKEN_SCRIPT, hostname, serverThreads, TARGET_HOSTNAME);
            }
        }

        await ns.sleep(weakenTime * 1000 + 100);
        ++iteration;
    }
}
