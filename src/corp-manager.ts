import { NS } from '@ns'
import { isSet } from 'lodash';

const CYCLE_MILLIS = 10000;
const TICK_INTERVAL = 10000;
const BONUS_TICK_INTERVAL = 1000;
const UPGRADE_COST_WEIGHT = 100;
const EMPLOYEE_COST_WEIGHT_PROD_DEV_CITY = 1;
const EMPLOYEE_COST_WEIGHT_OTHER_CITY_SMALL = 5;
const EMPLOYEE_COST_WEIGHT_OTHER_CITY_LARGE = 100;
const ADVERT_COST_WEIGHT_PROD = 1;
const ADVERT_COST_WEIGHT_NON_PROD = 100;
const OFFICE_GROW_SIZE_SMALL = 3;
const OFFICE_GROW_SIZE_LARGE = 15;
const PROD_DEV_CITY = 'Aevum';
const PROD_NAME_PREFIX = 'Widget v';
const DESIGN_INVEST = 1e9;
const MARKETTING_INVEST = 1e9;
const WAREHOUSE_MATERIALS_RATIO = 0.5;
const WAREHOUSE_HIGH_USAGE_RATIO = 0.8;
const WAREHOUSE_COST_WEIGHT_HIGH_USAGE = 5;
const LARGE_WAREHOUSE_SIZE = 2000;
const WAREHOUSE_COST_WEIGHT_SMALL = 50;
const WAREHOUSE_COST_WEIGHT_LARGE = 500;
const MAX_ASSIGNED_EMPLOYEES_PER_CYCLE = 10;
const ASSIGN_TIME_MILLIS = 1000;
const MIN_RESEARCH = 100000;

const CORP_UPGRADES = [
    "Smart Factories",
    "Smart Storage",
    "DreamSense",
    "Wilson Analytics",
    "Nuoptimal Nootropic Injector Implants",
    "Speech Processor Implants",
    "Neural Accelerators",
    "FocusWires",
    "ABC SalesBots",
    "Project Insight",
];

const CITIES = [
    "Aevum",
    "Chongqing",
    "Ishima",
    "New Tokyo",
    "Sector-12",
    "Volhaven"
];

const JOBS = [
    "Operations",
    "Engineer",
    "Business",
    "Management",
    "Research & Development"
]

const INDUSTRIES_WITH_PRODUCTS = [
    "Computer",
    "Food",
    "Healthcare",
    "Pharmaceutical",
    "RealEstate",
    "Robotics",
    "Software",
    "Tobacco"
];


const RESEARCH_HIGH_TECH_LAB = 'Hi-Tech R&D Laboratory';
const RESEARCH_UPGRADE_FULCRUM = 'uPgrade: Fulcrum';
const RESEARCH_UPGRADE_CAP_I = '"uPgrade: Capacity.I';
const RESEARCH_UPGRADE_CAP_II = '"uPgrade: Capacity.II';
const RESEARCH_REST = [
    'Automatic Drug Administration',
    'CPH4 Injections',
    'Drones',
    'Drones - Assembly',
    'Drones - Transport',
    'Overclock',
    'Self-Correcting Assemblers',
    'Sti.mu',
    'Go-Juice',
    'JoyWire',
    'AutoBrew',
    'AutoPartyManager'
];

interface IProdBonusMap {
    [ industryType: string ]: [ number, number, number, number ];
}
const PROD_BONUS_MATERIALS: IProdBonusMap = {
    'Agriculture':       [ 0.30, 0.20, 0.72, 0.30 ],
    'Chemical':          [ 0.20, 0.20, 0.25, 0.25 ],
    'Computer Hardware': [ 0.19, 0.00, 0.20, 0.36 ],
    'Energy':            [ 0.30, 0.00, 0.65, 0.05 ],
    'Fishing':           [ 0.20, 0.35, 0.15, 0.50 ],
    'Food':              [ 0.25, 0.15, 0.05, 0.30 ],
    'Healthcare':        [ 0.10, 0.10, 0.10, 0.10 ],
    'Mining':            [ 0.45, 0.40, 0.30, 0.45 ],
    'Pharmaceutical':    [ 0.20, 0.15, 0.05, 0.25 ],
    'RealEstate':        [ 0.60, 0.05, 0.00, 0.60 ],
    'Robotics':          [ 0.36, 0.19, 0.32, 0.00 ],
    'Software':          [ 0.18, 0.25, 0.15, 0.05 ],
    'Tobacco':           [ 0.15, 0.15, 0.15, 0.20 ],
    'Water Utilities':   [ 0.40, 0.00, 0.50, 0.40 ]
};
interface IJobCountMap {
    [ job: string ]: number;
}

const PROD_SIZES = [ 0.1, 0.06, 0.005, 0.5 ];
const MAT_AI = 'AI Cores';
const MAT_HW = 'Hardware';
const MAT_RE = 'Real Estate';
const MAT_ROB = 'Robots';

interface IBestMatRatioMap {
    [ industryType: string ]: [ number, number, number, number ];
}
const bestMatRatios: IBestMatRatioMap = {};

export async function main(ns : NS) : Promise<void> {
    ns.disableLog('ALL');
    ns.enableLog('print');

    while (true) {
        buyCorpUpgrades(ns);
        addCityExpansions(ns);
        growOffices(ns);
        hireAdvert(ns);
        makeProducts(ns);
        growWarehouses(ns);
        buyResearch(ns);
        await buyMaterials(ns);

        const numAssigned = await assignEmployees(ns, MAX_ASSIGNED_EMPLOYEES_PER_CYCLE);
        const sleepTime = Math.max(0, CYCLE_MILLIS - numAssigned * ASSIGN_TIME_MILLIS);
        await ns.sleep(sleepTime);
    }
}

function buyCorpUpgrades(ns: NS): void {
    const corp = ns.corporation.getCorporation();
    let funds = corp.funds;

    for (const upgrade of CORP_UPGRADES) {
        const cost = ns.corporation.getUpgradeLevelCost(upgrade);
        const hasProducts = corp.divisions.filter(division => division.products.length > 0).length > 0;
        const weight = hasProducts && upgrade == 'Wilson Analytics' ? 1 : UPGRADE_COST_WEIGHT;
        const weightedCost = cost * weight;

        if (weightedCost <= funds) {
            const level = ns.corporation.getUpgradeLevel(upgrade);
            ns.print(`CORP: Upgrading '${upgrade}' to level ${level + 1} for ${ns.nFormat(cost, '$0.00a')}.`);
            ns.corporation.levelUpgrade(upgrade);
            funds -= cost;
        }
    }
}

function addCityExpansions(ns: NS) {
    const corp = ns.corporation.getCorporation();
    let funds = corp.funds;

    for (const division of corp.divisions) {
        for (const city of CITIES) {
            if (! division.cities.includes(city)) {
                ns.print(`${division.name}: Expanding to '${city}'.`);
                ns.corporation.expandCity(division.name, city);

                for (let i = 0; i < 3; ++i) {
                    const employee = ns.corporation.hireEmployee(division.name, city);

                    if (! employee) {
                        ns.print(`ERROR ${division.name}:${city}: Unable to hire employee.`);
                        continue;
                    }
                }
            }

            if (! ns.corporation.hasWarehouse(division.name, city)) {
                const cost = ns.corporation.getPurchaseWarehouseCost();

                if (cost <= funds) {
                    ns.print(`${division.name}:${city}: Purchasing warehouse for ${ns.nFormat(cost, '$0.00a')}.`);
                    ns.corporation.purchaseWarehouse(division.name, city);
                    funds -= cost;

                    ns.corporation.setSmartSupply(division.name, city, true);
                }
            }
        }
    }
}

function growOffices(ns: NS): void {
    const corp = ns.corporation.getCorporation();
    let funds = corp.funds;

    for (const division of corp.divisions) {
        for (const city of division.cities) {
            const office = ns.corporation.getOffice(division.name, city);
            let weight;

            if (division.products.length > 0 && city == PROD_DEV_CITY) {
                weight = EMPLOYEE_COST_WEIGHT_PROD_DEV_CITY;
            } else if (office.employees.length < OFFICE_GROW_SIZE_LARGE) {
                weight = EMPLOYEE_COST_WEIGHT_OTHER_CITY_SMALL;
            } else {
                weight = EMPLOYEE_COST_WEIGHT_OTHER_CITY_LARGE;
            }

            const growSize = office.employees.length < OFFICE_GROW_SIZE_LARGE ?
                OFFICE_GROW_SIZE_SMALL : OFFICE_GROW_SIZE_LARGE;
            const cost = ns.corporation.getOfficeSizeUpgradeCost(division.name, city, growSize);
            const weightedCost = weight * cost;

            if (weightedCost > funds) {
                continue;
            }

            ns.print(`${division.name}:${city}: Adding ${growSize} employees for ${ns.nFormat(cost, '$0.00a')}.`);
            ns.corporation.upgradeOfficeSize(division.name, city, growSize);
            funds -= cost;

            for (let i = 0; i < growSize; ++i) {
                const employee = ns.corporation.hireEmployee(division.name, city);

                if (! employee) {
                    ns.print(`ERROR ${division.name}:${city}: Unable to hire employee.`);
                    continue;
                }
            }
        }
    }
}

async function assignEmployees(ns: NS, maxAssigned: number): Promise<number> {
    const corp = ns.corporation.getCorporation();
    let numAssigned = 0;

    for (const division of corp.divisions) {
        for (const city of division.cities) {
            const office = ns.corporation.getOffice(division.name, city);
            const jobCounts: IJobCountMap = {};
            JOBS.forEach(job => { jobCounts[job] = 0; });

            for (const employeeName of office.employees) {
                const employee = ns.corporation.getEmployee(division.name, city, employeeName);

                if (! (employee.pos in jobCounts)) {
                    jobCounts[employee.pos] = 0;
                }

                ++jobCounts[employee.pos];
            }

            for (const employeeName of office.employees) {
                const employee = ns.corporation.getEmployee(division.name, city, employeeName);

                if (employee.pos != 'Unassigned') {
                    continue;
                }

                let bestJob = '';
                let bestJobCount = 10000000;

                for (const job of JOBS) {
                    const jobCount = jobCounts[job] || 0;

                    if (jobCount < bestJobCount) {
                        bestJob = job;
                        bestJobCount = jobCount;
                    }
                }

                ns.print(`${division.name}:${city}: Assigning job for ${bestJob}`);
                await ns.corporation.assignJob(division.name, city, employee.name, bestJob);
                ++jobCounts[bestJob];
                ++numAssigned;

                if (numAssigned >= maxAssigned) {
                    return numAssigned;
                }
            }
        }
    }

    return numAssigned;
}

function hireAdvert(ns: NS): void {
    const corp = ns.corporation.getCorporation();
    let funds = corp.funds;

    for (const division of corp.divisions) {
        const advertCount = ns.corporation.getHireAdVertCount(division.name);
        const weight = advertCount == 0 || division.products.length > 0 ?
            ADVERT_COST_WEIGHT_PROD : ADVERT_COST_WEIGHT_NON_PROD;
        const cost = ns.corporation.getHireAdVertCost(division.name);
        const weightedCost = cost * weight;

        if (weightedCost <= funds) {
            ns.print(`${division.name}: Increasing AdVert for ${ns.nFormat(cost, '$0.00a')}.`);
            ns.corporation.hireAdVert(division.name);
            funds -= cost;
        }
    }
}

function makeProducts(ns: NS): void {
    const corp = ns.corporation.getCorporation();
    let funds = corp.funds;

    for (const division of corp.divisions) {
        if (! INDUSTRIES_WITH_PRODUCTS.includes(division.type)) {
            continue;
        }

        let isDevelopingProduct = false;
        let oldestProductName = '';
        let oldestProductId = 1000000;
        let newestProductId = 0;
        let largestPriceMultiplier = 1;

        for (const productName of division.products) {
            const product = ns.corporation.getProduct(division.name, productName);
            const productId = parseInt(productName.substring(PROD_NAME_PREFIX.length));

            if (productId < oldestProductId) {
                oldestProductName = productName;
                oldestProductId = productId;
            }

            if (productId > newestProductId) {
                newestProductId = productId;
            }

            const sellCost = product.sCost;

            if (typeof sellCost == 'string') {
                const priceMultiplier = parseInt(sellCost.replace(/^MP\s*\*\s*/, ''));

                if (priceMultiplier > largestPriceMultiplier) {
                    largestPriceMultiplier = priceMultiplier;
                }
            }

            if (product.developmentProgress < 100) {
                isDevelopingProduct = true;
            } else if (! product.sCost) {
                const sellCost = `MP*${largestPriceMultiplier}`;
                ns.corporation.sellProduct(division.name, PROD_DEV_CITY, productName, 'MAX', sellCost, true);

                if (ns.corporation.hasResearched(division.name, 'Market-TA.II')) {
                    ns.corporation.setProductMarketTA2(division.name, productName, true);
                }
            }
        }

        if (isDevelopingProduct) {
            continue;
        }

        const cost = DESIGN_INVEST + MARKETTING_INVEST;

        if (cost > funds) {
            continue;
        }

        let maxProducts = 3;

        if (ns.corporation.hasResearched(division.name, 'uPgrade: Capacity.I')) {
            ++maxProducts;
        }


        if (ns.corporation.hasResearched(division.name, 'uPgrade: Capacity.II')) {
            ++maxProducts;
        }

        if (division.products.length >= maxProducts) {
            ns.corporation.discontinueProduct(division.name, oldestProductName);
        }

        const newProductName = `${PROD_NAME_PREFIX}${newestProductId + 1}`;
        ns.print(`${division.name} Creating new product '${newProductName}' for ${ns.nFormat(cost, '$0.00a')}.`);
        ns.corporation.makeProduct(division.name, PROD_DEV_CITY, newProductName, DESIGN_INVEST, MARKETTING_INVEST);
        funds -= cost;
    }
}

function growWarehouses(ns: NS): void {
    const corp = ns.corporation.getCorporation();
    let funds = corp.funds;

    for (const division of corp.divisions) {
        for (const city of division.cities) {
            if (! ns.corporation.hasWarehouse(division.name, city)) {
                continue;
            }

            const warehouse = ns.corporation.getWarehouse(division.name, city);
            const ratioUsed = warehouse.sizeUsed / warehouse.size;
            const cost = ns.corporation.getUpgradeWarehouseCost(division.name, city);
            const weight = ratioUsed > WAREHOUSE_HIGH_USAGE_RATIO ? WAREHOUSE_COST_WEIGHT_HIGH_USAGE :
                (warehouse.size < LARGE_WAREHOUSE_SIZE ? WAREHOUSE_COST_WEIGHT_SMALL : WAREHOUSE_COST_WEIGHT_LARGE);
            const weightedCost = cost * weight;

            if (weightedCost <= funds) {
                ns.print(`${division.name}:${city}: Growing warehouse for ${ns.nFormat(cost, '$0.00a')}.`);
                ns.corporation.upgradeWarehouse(division.name, city);
                funds -= cost;
            }
        }
    }
}

async function buyMaterials(ns: NS): Promise<void> {
    const corp = ns.corporation.getCorporation();

    for (const division of corp.divisions) {
        for (const city of division.cities) {
            if (! ns.corporation.hasWarehouse(division.name, city)) {
                continue;
            }

            const warehouse = ns.corporation.getWarehouse(division.name, city);
            const usableSpace = warehouse.size * WAREHOUSE_MATERIALS_RATIO;

            if (warehouse.sizeUsed >= usableSpace) {
                continue;
            }

            const [newAiAmount, newHwAmount, newReAmount, newRobAmount] = getBestMaterialRatios(division.type, usableSpace);
            const aiMaterial = ns.corporation.getMaterial(division.name, city, MAT_AI);
            const hwMaterial = ns.corporation.getMaterial(division.name, city, MAT_HW);
            const reMaterial = ns.corporation.getMaterial(division.name, city, MAT_RE);
            const robMaterial = ns.corporation.getMaterial(division.name, city, MAT_ROB);
            const aiBuyAmount = Math.floor(newAiAmount - aiMaterial.qty);
            const hwBuyAmount = Math.floor(newHwAmount - hwMaterial.qty);
            const reBuyAmount = Math.floor(newReAmount - reMaterial.qty);
            const robBuyAmount = Math.floor(newRobAmount - robMaterial.qty);

            let boughtMaterials = false;

            if (aiBuyAmount > 0) {
                ns.print(`${division.name}:${city}: Bought ${aiBuyAmount} ${MAT_AI}.`);
                ns.corporation.buyMaterial(division.name, city,  MAT_AI, aiBuyAmount / TICK_INTERVAL);
                boughtMaterials = true;
            }

            if (hwBuyAmount > 0) {
                ns.print(`${division.name}:${city}: Bought ${hwBuyAmount} ${MAT_HW}.`);
                ns.corporation.buyMaterial(division.name, city, MAT_HW, (hwBuyAmount) / TICK_INTERVAL);
                boughtMaterials = true;
            }

            if (reBuyAmount > 0) {
                ns.print(`${division.name}:${city}: Bought ${reBuyAmount} ${MAT_RE}.`);
                ns.corporation.buyMaterial(division.name, city, MAT_RE, (reBuyAmount) / TICK_INTERVAL);
                boughtMaterials = true;
            }

            if (robBuyAmount > 0) {
                ns.print(`${division.name}:${city}: Bought ${robBuyAmount} ${MAT_ROB}.`);
                ns.corporation.buyMaterial(division.name, city, MAT_ROB, (robBuyAmount) / TICK_INTERVAL);
                boughtMaterials = true;
            }

            if (boughtMaterials) {
                const tickInterval = ns.corporation.getBonusTime() > 0 ? BONUS_TICK_INTERVAL : TICK_INTERVAL;
                await ns.sleep(tickInterval);
                ns.corporation.buyMaterial(division.name, city, MAT_AI, 0);
                ns.corporation.buyMaterial(division.name, city, MAT_HW, 0);
                ns.corporation.buyMaterial(division.name, city, MAT_RE, 0);
                ns.corporation.buyMaterial(division.name, city, MAT_ROB, 0);
            } else {
                await ns.sleep(0);
            }
        }
    }
}

function getBestMaterialRatios(industryType: string, warehouseSize: number): [number, number, number, number] {
    const key = `${industryType}:${warehouseSize}`;

    if (! (key in bestMatRatios)) {
        bestMatRatios[key] = computeBestMaterialRatios(industryType, warehouseSize);
    }

    return bestMatRatios[key];
}

// Based on
// https://discordapp.com/channels/415207508303544321/923445881389338634/932423053504299079
function computeBestMaterialRatios(industryType: string, warehouseSize: number): [number, number, number, number] {
    const [ aiFac, hwFac, reFac, robFac ] = PROD_BONUS_MATERIALS[industryType];
    const [ aiSize, hwSize, reSize, robSize ] = PROD_SIZES;

    const solution = {
        hw: 0,
        rob: 0,
        ai: 0,
        re: 0,
        cityMult: 0
    }

    for (let hwRatio = 0; hwRatio <= 100; hwRatio ++) {
        for (let robRatio = 0; robRatio <= 100 - hwRatio; robRatio ++) {
            for (let aiRatio = 0; aiRatio <= 100 - hwRatio - robRatio; aiRatio ++) {
                const reRatio = 100 - hwRatio - robRatio - aiRatio

                const hw = Math.floor(warehouseSize * hwRatio / 100 / hwSize)
                const rob = Math.floor(warehouseSize * robRatio / 100 / robSize)
                const ai = Math.floor(warehouseSize * aiRatio / 100 / aiSize)
                const re = Math.floor(warehouseSize * reRatio / 100 / reSize)

                const cityMult = Math.pow(Math.pow(0.002 * re + 1, reFac) *
                    Math.pow(0.002 * hw + 1, hwFac) *
                    Math.pow(0.002 * rob + 1, robFac) *
                    Math.pow(0.002 * ai + 1, aiFac), 0.73)

                if (cityMult > solution.cityMult) {
                    solution.hw = hw
                    solution.rob = rob
                    solution.ai = ai
                    solution.re = re
                    solution.cityMult = cityMult
                }
            }
        }
    }

    return [
        solution.ai,
        solution.hw,
        solution.re,
        solution.rob
    ];
}

function buyResearch(ns: NS): void {
    const corp = ns.corporation.getCorporation();

    for (const division of corp.divisions) {
        if (! ns.corporation.hasResearched(division.name, RESEARCH_HIGH_TECH_LAB)) {
            const cost = ns.corporation.getResearchCost(division.name, RESEARCH_HIGH_TECH_LAB);

            if (division.research > 2 * cost) {
                ns.print(`${division.name}: Researching ${RESEARCH_HIGH_TECH_LAB}`);
                ns.corporation.research(division.name, RESEARCH_HIGH_TECH_LAB);
            }

            continue;
        }

        if (
            division.products.length > 0 &&
            (
                ! ns.corporation.hasResearched(division.name, RESEARCH_UPGRADE_FULCRUM)
                || ! ns.corporation.hasResearched(division.name, RESEARCH_UPGRADE_CAP_I)
                || ! ns.corporation.hasResearched(division.name, RESEARCH_UPGRADE_CAP_II)
            )
        ) {
            const cost = ns.corporation.getResearchCost(division.name, RESEARCH_UPGRADE_FULCRUM) +
                ns.corporation.getResearchCost(division.name, RESEARCH_UPGRADE_CAP_I) +
                ns.corporation.getResearchCost(division.name, RESEARCH_UPGRADE_CAP_II);

            if (division.research > 2 * cost) {
                ns.print(`${division.name}: Researching ${RESEARCH_UPGRADE_FULCRUM}`);
                ns.corporation.research(division.name, RESEARCH_UPGRADE_FULCRUM);
                ns.print(`${division.name}: Researching ${RESEARCH_UPGRADE_CAP_I}`);
                ns.corporation.research(division.name, RESEARCH_UPGRADE_CAP_I);
                ns.print(`${division.name}: Researching ${RESEARCH_UPGRADE_CAP_II}`);
                ns.corporation.research(division.name, RESEARCH_UPGRADE_CAP_II);
            }

            continue;
        }

        for (const research of RESEARCH_REST) {
            if (! ns.corporation.hasResearched(division.name, research)) {
                const cost = ns.corporation.getResearchCost(division.name, research);

                if (division.research - cost > MIN_RESEARCH) {
                    ns.print(`${division.name}: Researching ${research}`);
                    ns.corporation.research(division.name, research);
                }

                break;
            }
        }

    }
}
