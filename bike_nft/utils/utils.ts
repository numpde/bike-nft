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
            throw new Error('Unknown network');
    }
}

export async function execute(tx) {
    console.log(`Transaction hash: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`Transaction status: ${receipt.status}`);
}

export async function getMostRecent(path): Promise<any> {
    const files = glob.sync(path).sort();
    if (files.length == 0) {
        throw new Error('No files found in ' + path)
    }
    const file = files[files.length - 1];
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

export async function packJSON(data) {
    return "data:application/json;base64," + Buffer.from(JSON.stringify(data)).toString('base64');
}
