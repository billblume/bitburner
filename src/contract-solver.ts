import { NS } from '@ns';
import { getAllServerHostnames } from './lib/server'

export async function main(ns: NS): Promise<void> {
    const hostnames = getAllServerHostnames(ns);

    for (const hostname of hostnames) {
        const contracts = ns.ls(hostname)
            .filter(filename => filename.endsWith('.cct'));

        for (const contract of contracts) {
            runContract(ns, hostname, contract);
            await ns.sleep(100);
        }
    }
}

function runContract(ns: NS, hostname: string, filename: string): void {
    const type = ns.codingcontract.getContractType(filename, hostname);
    const description = ns.codingcontract.getDescription(filename, hostname);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const data = ns.codingcontract.getData(filename, hostname);

    ns.tprint(`INFO: ${hostname}/${filename}: ${type}\n${description}`);
    let answer = null;

    switch (type) {
        case 'Algorithmic Stock Trader I':
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            answer = algorithmicStockTraderI(data);
            break;

        case 'Algorithmic Stock Trader II':
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            answer = algorithmicStockTraderII(data);
            break;

        case 'Algorithmic Stock Trader III':
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            answer = algorithmicStockTraderIII(data);
            break;

        case 'Algorithmic Stock Trader IV':
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            answer = algorithmicStockTraderIV(data);
            break;

        case 'Array Jumping Game':
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            answer = arrayJumpingGame(data);
            break;

        case 'Find All Valid Math Expressions':
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            answer = findAllValidMathExpressions(data);
            break;

        case 'Find Largest Prime Factor':
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            answer = findLargestPrimeFactor(data);
            break;

        case 'Generate IP Addresses':
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            answer = generateIpAddresses(data);
            break;

        case 'Merge Overlapping Intervals':
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            answer = mergeOverlappingIntervals(data);
            break;

        case 'Minimum Path Sum in a Triangle':
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            answer = minimumPathSumInATriangle(data);
            break;

        case 'Sanitize Parentheses in Expression':
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            answer = sanitizeParenthesesInExpression(data);
            break;

        case 'Spiralize Matrix':
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            answer = spiralizeMatrix(data);
            break;

        case 'Subarray with Maximum Sum':
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            answer = subarrayWithMaximumSum(data);
            break;

        case 'Total Ways to Sum':
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            answer = totalWaysToSum(data);
            break;

        case 'Unique Paths in a Grid I':
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            answer = uniquePathsInGridI(data);
            break;

        case 'Unique Paths in a Grid II':
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            answer = uniquePathsInGridII(data);
            break;

        default:
            ns.tprint(`FAILED: Unknown contract type: ${type}`);
            return;
    }

    if (answer === null) {
        ns.tprint(`FAILED: Error while computing answer`);
        return;
    }

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const status = ns.codingcontract.attempt(answer, filename, hostname, { "returnReward": true });

    if (status) {
        ns.tprint(`SUCCESS: ${String(status)}`);
    } else {
        const attemptsRemaining = ns.codingcontract.getNumTriesRemaining(filename, hostname);
        ns.tprint(`FAILED: Answer ${JSON.stringify(answer)} is wrong.  ${attemptsRemaining} attempts remaining`);
    }
}

function algorithmicStockTraderI(data: number[]): number {
    let maxPrice = 0;
    let maxProfit = 0;

    for (let i = data.length - 1; i >= 0; --i) {
        const price = data[i];

        if (maxPrice < price) {
            maxPrice = price;
        }

        const profit = maxPrice - price;

        if (profit > maxProfit) {
            maxProfit = profit;
        }
    }

    return maxProfit;
}

function algorithmicStockTraderII(data: number[]): number {
    let profit = 0;

    for (let i = 1; i < data.length; ++i) {
        if (data[i] > data[i - 1]) {
            profit += data[i] - data[i - 1];
        }
    }

    return profit;
}

function algorithmicStockTraderIII(data: number[]): number {
    return getMaxProfit(2, data);
}

function algorithmicStockTraderIV(data: [number, number[]]): number {
    const maxTrades = data[0];
    const prices = data[1];
    return getMaxProfit(maxTrades, prices);
}

function getMaxProfit(maxTrades: number, prices: number[]): number {
    if (maxTrades <= 0) {
        return 0;
    }

    while (prices.length >= 2 && prices[0] >= prices[1]) {
        prices.shift();
    }

    if (prices.length < 2) {
        return 0;
    }

    return Math.max(
        getMaxProfitBuyToday(maxTrades, prices),
        getMaxProfit(maxTrades, prices.slice(1))
    );
}

function getMaxProfitBuyToday(maxTrades: number, prices: number[]): number {
    if (prices.length < 2) {
        return 0;
    }

    const buyPrice = prices.shift();

    if (buyPrice === undefined) {
        return 0;
    }

    let minSellPrice = buyPrice;
    let maxProfit = 0;

    for (let i = 0; i < prices.length; ++i) {
        while (i < prices.length - 1 && prices[i] < prices[i + 1]) {
            ++i;
        }

        if (prices[i] > minSellPrice) {
            minSellPrice = prices[i];
            const profit = minSellPrice - buyPrice
                + getMaxProfit(maxTrades - 1, prices.slice(i + 1));

            if (profit > maxProfit) {
                maxProfit = profit;
            }
        }
    }

    return maxProfit;
}

function arrayJumpingGame(data: number[]): number {
    if (data.length == 0) {
        return 1;
    }

    const reachable = new Array<number>(data.length);
    reachable.fill(0);
    reachable[1] = 1;

    for (let i = 0; i < reachable.length; ++i) {
        if (reachable[i]) {
            for (let j = i + 1; j < i + data[i]; ++i) {
                reachable[j] = 1;
            }
        }
    }

    return reachable[data.length - 1];
}

function findAllValidMathExpressions(data: [string, number]): string[] {
    const digitString = data[0];
    const target = data[1];

    if (digitString == '') {
        return [];
    }

    const numberSets = splitIntoNumbers(digitString);
    let solutions: string[] = [];

    for (const numberSet of numberSets) {
        const setSolutions = findSolutions(numberSet, target);
        solutions = solutions.concat(setSolutions);
    }

    return solutions;
}

function splitIntoNumbers(digitString: string): number[][] {
    const numberSets = [];

    if (digitString.length == 0) {
        // do nothing.
    } else if (digitString.length == 1) {
        numberSets.push([parseInt(digitString)]);
    } else if (digitString[0] == '0') {
        const suffixNumberSets = splitIntoNumbers(digitString.substring(1));
        suffixNumberSets.forEach(numberSet => {
            numberSet.unshift(0);
            numberSets.push(numberSet);
        });
    } else {
        for (let i = 1; i < digitString.length; ++i) {
            const firstNumber = parseInt(digitString.substring(0, i));
            const suffixNumberSets = splitIntoNumbers(digitString.substring(i));
            suffixNumberSets.forEach(numberSet => {
                numberSet.unshift(firstNumber);
                numberSets.push(numberSet);
            });
        }

        numberSets.push([parseInt(digitString)]);
    }

    return numberSets;
}

function findSolutions(numberSet: number[], target: number): string[] {
    const solutions = [];

    for (let i = numberSet.length - 1; i >= 0; --i) {
        const remainingNumbers = numberSet.slice(0, i);
        const multNumbers = numberSet.slice(i);
        const multTerm = multNumbers.reduce(
            (prev, curr) => prev * curr,
            1
        );
        const multStr = multNumbers.join('*');

        if (remainingNumbers.length > 0) {
            const plusSolutions = findSolutions(remainingNumbers, target - multTerm);
            plusSolutions.forEach(sol => solutions.push(sol + '+' + multStr));
            const minusSolutions = findSolutions(remainingNumbers, target + multTerm);
            minusSolutions.forEach(sol => solutions.push(sol + '-' + multStr));
        } else if (multTerm == target) {
            solutions.push(multStr);
        }
    }

    return solutions;
}

function findLargestPrimeFactor(data: number): number {
    let num = data;
    const sqrt = Math.sqrt(num);
    let maxFactor = 1;
    let factor = 2;

    while (factor <= sqrt) {
        if (isPrime(factor)) {
            while (num % factor === 0) {
                num = num / factor;

                if (maxFactor < factor) {
                    maxFactor = factor;
                }
            }
        }

        factor = factor == 2 ? 3 : factor + 2;
    }

    if (num > maxFactor) {
        maxFactor = num;
    }

    return maxFactor;
}

function isPrime(num: number): boolean {
    const sqrt = Math.sqrt(num);

    for (let i = 2; i <= sqrt; ++i) {
        if (num % i == 0) {
            return false;
        }
    }

    return true;
}

function generateIpAddresses(data: string, numOctets = 4): string[] {
    if (data.length == 0) {
        return [];
    }

    if (numOctets == 1) {
        if (data.startsWith('0') && data.length > 1) {
            return [];
        }

        if (parseInt(data) > 255) {
            return [];
        }

        return [data];
    }

    let ips: string[] = [];
    let octet = data.substr(0, 1);
    let suffixes = generateIpAddresses(data.substr(1), numOctets - 1);
    ips = ips.concat(suffixes.map(suffix => `${octet}.${suffix}`));

    if (octet !== '0') {
        octet = data.substr(0, 2);
        suffixes = generateIpAddresses(data.substr(2), numOctets - 1);
        ips = ips.concat(suffixes.map(suffix => `${octet}.${suffix}`));
        octet = data.substr(0, 3);

        if (parseInt(octet) <= 255) {
            suffixes = generateIpAddresses(data.substr(3), numOctets - 1);
            ips = ips.concat(suffixes.map(suffix => `${octet}.${suffix}`));
        }
    }

    return ips;
}

function mergeOverlappingIntervals(data: [number, number][]): [number, number][] {
    const sortedIntervals = data.sort((a: [number, number], b: [number, number]) => {
        if (a[0] < b[0]) {
            return -1;
        } else if (a[0] > b[0]) {
            return 1;
        } else if (a[1] < b[1]) {
            return -1;
        } else if (a[1] > b[1]) {
            return 1;
        }

        return 0;
    });

    const mergedIntervals: [number,number][] = [];
    let mergedInterval: [number,number] | null = null;

    for (const interval of sortedIntervals) {
        if (mergedInterval == null) {
            mergedInterval = interval;
        } else {
            if (interval[0] <= mergedInterval[1]) {
                mergedInterval[1] = Math.max(interval[1], mergedInterval[1]);
            } else {
                mergedIntervals.push(mergedInterval);
                mergedInterval = interval;
            }
        }
    }

    if (mergedInterval != null) {
        mergedIntervals.push(mergedInterval);
    }

    return mergedIntervals;
}

function minimumPathSumInATriangle(data: number[][]): number {
    if (data.length == 0) {
        return 0;
    }

    let sums = data[data.length - 1];

    for (let y = data.length - 2; y >= 0; --y) {
        const newSums: number[] = [];

        for (let x = 0; x < data[y].length; ++x) {
            newSums.push(data[y][x] + Math.min(sums[x], sums[x + 1]));
        }

        sums = newSums;
    }

    return sums[0];
}

function sanitizeParenthesesInExpression(data: string): string[] {
    const unmatchedOpen = getUnmatchedOpenParenCount(data);
    const unmatchedClosed = getUnmatchedCloseParenCount(data);
    let answer = removeParens([data], '(', unmatchedOpen);
    answer = removeParens(answer, ')', unmatchedClosed);
    answer = answer.filter(areParensValid);
    answer.sort();
    return answer;
}

function getUnmatchedOpenParenCount(expr: string): number {
    let unmatched = 0;
    let numClosed = 0;

    for (let i = expr.length - 1; i >= 0; --i) {
        const ch = expr.charAt(i);

        if (ch == ')') {
            ++numClosed;
        } else if (ch == '(') {
            if (numClosed > 0) {
                --numClosed;
            } else {
                ++unmatched;
            }
        }
    }

    return unmatched;
}

function getUnmatchedCloseParenCount(expr: string): number {
    let unmatched = 0;
    let numOpen = 0;

    for (let i = 0; i < expr.length; ++i) {
        const ch = expr.charAt(i);

        if (ch == '(') {
            ++numOpen;
        } else if (ch == ')') {
            if (numOpen > 0) {
                --numOpen;
            } else {
                ++unmatched;
            }
        }
    }

    return unmatched;
}

function areParensValid(expr: string): boolean {
    return getUnmatchedOpenParenCount(expr) == 0 &&
        getUnmatchedCloseParenCount(expr) == 0;
}

function removeParens(exprs: string[], parenChar: string, count: number): string[] {
    let results = exprs;

    for (let i = 0; i < count; ++i) {
        const newResults: string[] = [];

        for (const expr of results) {
            for (let j = 0; j < expr.length; ++j) {
                if (expr.charAt(j) == parenChar) {
                    const newExpr = expr.slice(0, j) + expr.slice(j + 1);

                    if (!newResults.includes(newExpr)) {
                        newResults.push(newExpr);
                    }
                }
            }
        }

        results = newResults;
    }

    return results;
}

function spiralizeMatrix(data: number[][]): number[] {
    const answer: number[] = [];
    let minY = 0;
    let maxY = data.length - 1;

    if (maxY < 0) {
        return answer;
    }

    let minX = 0;
    let maxX = data[0].length - 1;

    while (true) {
        if (minX > maxX) {
            return answer;
        }

        for (let x = minX; x <= maxX; ++x) {
            answer.push(data[minY][x]);
        }

        ++minY;

        if (minY > maxY) {
            return answer;
        }

        for (let y = minY; y <= maxY; ++y) {
            answer.push(data[y][maxX]);
        }

        --maxX;

        if (minX > maxX) {
            return answer;
        }

        for (let x = maxX; x >= minX; --x) {
            answer.push(data[maxY][x]);
        }

        --maxY;

        if (minY > maxY) {
            return answer;
        }

        for (let y = maxY; y >= minY; --y) {
            answer.push(data[y][minX]);
        }

        ++minX;
    }
}

function subarrayWithMaximumSum(data: number[]): number {
    if (data.length == 0) {
        return 0;
    }

    const sum = new Array<number>(data.length);
    const minSum = new Array<number>(data.length);
    sum[0] = data[0];
    minSum[0] = Math.min(0, data[0]);

    for (let i = 1; i < data.length; ++i) {
        sum[i] = sum[i - 1] + data[i];
        minSum[i] = Math.min(minSum[i - 1], sum[i]);
    }

    let maxSum = data[0];

    for (let i = 1; i < sum.length; ++i) {
        maxSum = Math.max(maxSum, sum[i] - minSum[i - 1]);
    }

    return maxSum;
}

function totalWaysToSum(data: number): number {
    return totalWaysToSum1(data, 1);
}

function totalWaysToSum1(num: number, min: number): number {
    let count = 0;

    for (let i = min; i <= num / 2; ++i) {
        count += 1 + totalWaysToSum1(num - i, i);
    }

    return count;
}

function uniquePathsInGridI(data: number[]): number {
    let x = data[0] - 1;
    let y = data[1] - 1;

    if (x <= 0 || y <= 0) {
        return 1;
    }

    if (x < y) {
        const t = x;
        x = y;
        y = t;
    }

    let a = 1;
    let b = 1;

    for (let i = x + 1; i <= x + y; ++i) {
        a *= i;
    }

    for (let i = 2; i <= y; ++i) {
        b *= i;
    }

    return a / b;
}

function uniquePathsInGridII(data: number[][]): number {
    const numRows = data.length;

    if (numRows == 0) {
        return 0;
    }

    const numCols = data[0].length;

    if (numCols == 0) {
        return 0;
    }

    const paths: number[][] = [];

    for (let y = 0; y < numRows; ++y) {
        paths.push(new Array<number>(numCols));
    }

    for (let y = 0; y < numRows; ++y) {
        for (let x = 0; x < numCols; ++x) {
            if (data[y][x] == 1) {
                paths[y][x] = 0;
            } else if (y == 0 && x == 0) {
                paths[y][x] = 1;
            } else {
                let numPaths = 0;

                if (y > 0) {
                    numPaths += paths[y - 1][x];
                }

                if (x > 0) {
                    numPaths += paths[y][x - 1];
                }

                paths[y][x] = numPaths;
            }
        }
    }

    return paths[numRows - 1][numCols - 1];
}
