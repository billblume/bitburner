import { NS } from '@ns';

const PORT_BREAKERS = [
    'BruteSSH.exe',
    'FTPCrack.exe',
    'relaySMTP.exe',
    'HTTPWorm.exe',
    'SQLInject.exe'
];

export function canCrackServer(ns: NS, hostname: string): boolean {
    if (ns.hasRootAccess(hostname)) {
        return false;
    }

    if (ns.getServerRequiredHackingLevel(hostname) > ns.getHackingLevel()) {
        return false;
    }

    const openablePorts = PORT_BREAKERS.filter(app => ns.fileExists(app, 'home')).length;
    return ns.getServerNumPortsRequired(hostname) <= openablePorts;
}

export function crackServer(ns: NS, hostname: string): void {
    if (ns.fileExists('BruteSSH.exe', 'home')) {
        ns.brutessh(hostname);
    }

    if (ns.fileExists('FTPCrack.exe', 'home')) {
        ns.ftpcrack(hostname);
    }

    if (ns.fileExists('relaySMTP.exe', 'home')) {
        ns.relaysmtp(hostname);
    }

    if (ns.fileExists('HTTPWorm.exe', 'home')) {
        ns.httpworm(hostname);
    }

    if (ns.fileExists('SQLInject.exe', 'home')) {
        ns.sqlinject(hostname);
    }

    ns.nuke(hostname);
}
