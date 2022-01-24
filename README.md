# Introduction

This repository contains a collection of scripts I wrote for the incremental game [Bitburner](https://github.com/danielyxie/bitburner).

## Installation

This repository is based off the [Bitburner VSCode Template](https://github.com/bitburner-official/bitburner-vscode).  The VS-Code template allows one to write typescript scripts that are compiled into javascript scripts usable by Bitburner.  Go to the link for instructions on how to configure VS-Code to compile and install these scripts into the Bitburner game.

## Scripts

Here is a brief description of the scripts provided in this repository.  These scripts can be broken into two categories: services and commands.
Commands run and exit quickly.  Services will run until killed.

### Services

* hack-manager.js: Service that chooses the best server for hacking and hacks that server.  It will also create private servers and hacknet servers.
* gang-manager.js: Service that creates, equips, and ascends gang members.  This script assumes that you have unlocked [Bitnode 2](https://bitburner.readthedocs.io/en/latest/guidesandtips/recommendedbitnodeorder.html#bitnode-2-rise-of-the-underworld).
* farm-hack.js: This service repeatedly weakens the server 'joesguns'.  It is used solely to increase one's hack stat.
* stock-trader.js: This service buys and sells stocks.  It only buys stocks that are likely to go up and sells them when they are more likely to go down.  Currently, this script does not know how to short stocks.  I haven't unlocked that yet.

### Commands

* hack-killall.js: Kills all agents invoked by hack-manager.js.
* contract-solver.js: Finds all contracts in the system and solves them.
* crackall.js: Cracks and backdoors all servers in the system.  Requires that you unlocked [Bitnode 4](https://bitburner.readthedocs.io/en/latest/guidesandtips/recommendedbitnodeorder.html#bitnode-4-the-singularity).  Can be slow.
* scan.ts: Prints out all servers in the system and their stats.  Meant as a replacement to the scan-analyze command.
* stock-sellall.js: Sell all stocks owned in the stock market.  Useful to execute before installing augments.
* watcher.js: Management script inherited from [Bitburner VSCode Template](https://github.com/bitburner-official/bitburner-vscode).

## About me

I am a senior software engineer with plenty of experience with writing javascript but not much experience with the latest frameworks and tools.   This is the first project that I've used typescript.
