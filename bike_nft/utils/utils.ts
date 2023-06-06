import * as glob from "glob";
import fs from "fs";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";

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

export async function execute(tx: any) {
    console.log(`Transaction hash: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`Transaction status: ${receipt.status}`);
}

export async function getMostRecent(path: string): Promise<any> {
    const files = glob.sync(path).sort();
    if (files.length == 0) {
        throw new Error('No files found in ' + path)
    }
    const file = files[files.length - 1];
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

export async function packJSON(data: object) {
    return "data:application/json;base64," + Buffer.from(JSON.stringify(data)).toString('base64');
}

export async function sendAllBalance(from: SignerWithAddress, to: SignerWithAddress) {
    const balance = await from.getBalance();
    const gasPrice = await from.provider.getGasPrice();

    // Estimate the gas required for the transaction
    const transactionResponse = await from.estimateGas({
        to: to.address,
        value: balance
    });

    const gasLimit = 21_000; //transactionResponse.toNumber();
    console.debug("Gas limit:", gasLimit)

    // Calculate the cost of gas for the transaction
    const gasCost = gasPrice.mul(gasLimit);
    console.debug("Gas cost:", gasCost.toString())

    if (balance > gasCost) {
        const value = balance.sub(gasCost); // balance - gasCost

        // Send the transaction
        const transaction = {
            to: to.address,
            value: value,
            gasPrice: gasPrice,
            gasLimit: gasLimit
        };
        const tx = await from.sendTransaction(transaction);

        // Wait for it to be mined
        await tx.wait();
    } else {
        console.log("Insufficient balance to cover gas cost");
    }
}
