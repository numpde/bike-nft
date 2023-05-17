import * as glob from "glob";
import fs from "fs";

export function getNetworkName(chainId: number): string {
    switch (chainId) {
        case 1:
            return 'mainnet';
        case 137:
            return 'polygon';
        case 1337:
            return 'ganache';
        case 80001:
            return 'mumbai';
        default:
            return 'unknown';
    }
}

export async function execute(tx) {
    console.log(`Transaction hash: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`Transaction status: ${receipt.status}`);
}

async function getMostRecent(path): Promise<any> {
    const files = glob.sync(path).sort();
    const file = files[files.length - 1];
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
}
