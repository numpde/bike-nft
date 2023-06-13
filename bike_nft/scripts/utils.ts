import {Contract, ContractFactory} from "ethers";
import {ethers, upgrades} from "hardhat";
import readlineSync from "readline-sync";
import path from "path";
import fs from "fs";
import util from 'util';
import glob from 'glob';

import {deployed} from "../deploy.config";
import {getNetworkName} from "../utils/utils";
import {saveAddress} from "./utils";
import {DeployProxyOptions} from "@openzeppelin/hardhat-upgrades/dist/utils";


interface ContractMetadata {
    [filename: string]: {
        [contractName: string]: any;
    };
}

export async function fetchContractMetadata(contractPath: string): Promise<ContractMetadata> {
    const globAsync = util.promisify(glob);
    const readFileAsync = util.promisify(fs.readFile);

    const files: string[] = await globAsync(path.join(contractPath, '*.json'));
    const metadata: ContractMetadata = {};

    for (const file of files) {
        const data: any = JSON.parse((await readFileAsync(file)).toString());
        const contracts: any = data.output.contracts;

        const fileName = path.basename(file);

        for (const contractFile in contracts) {
            for (const contractName in contracts[contractFile]) {
                if (!metadata[fileName]) {
                    metadata[fileName] = {};
                } else if (metadata[fileName][contractName]) {
                    throw new Error(`Contract name ${contractName} is ambiguous.`);
                }

                const contractMetadata: string = contracts[contractFile][contractName].metadata;
                metadata[fileName][contractName] = contractMetadata;
            }
        }
    }

    return metadata;
}


export function saveAddress(chainId: number, contractName: string, address: string) {
    const networkName = getNetworkName(chainId);
    const outputPath = path.join(__dirname, `../../deployed/network/${networkName}/${contractName}.json`);
    fs.writeFileSync(outputPath, JSON.stringify({address: address, network: chainId}, null, 4));
}

export async function report(contract: Contract) {
    console.log(`Contract here: ${contract.address} by ${contract.deployTransaction?.from}`);

    const proxyAddress = contract.address;
    console.log("Proxy Address:", proxyAddress);

    const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("Impln Address:", implementationAddress);

    // const adminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);
    // console.log("Admin Address:", adminAddress);
}

function isUpgradeable(Contract: ContractFactory): boolean {
    const contractABI = Contract.interface.fragments;
    return contractABI.some((entry) => entry.type === 'function' && entry.name === 'initialize');
}

type DeployParams = {
    contractName: string,
    args?: any[],
    deployer?: any,
    chainId: number,
    saveAbiTo?: string,
    onlyFetch?: boolean,
};

export async function deploy({contractName, args, deployer, chainId, saveAbiTo, onlyFetch}: DeployParams): Promise<{
    contract: Contract
}> {
    let contract: Contract | undefined = undefined;
    const deployedAddress = deployed[getNetworkName(chainId)]?.[contractName];

    if (onlyFetch) {
        console.log(`Fetching ${contractName} from:`, deployedAddress);
        contract = await ethers.getContractAt(contractName, deployedAddress);
        return {contract};
    }

    console.log("========================================");
    console.info(`Deploying ${contractName} on "${getNetworkName(chainId)}"...`);
    console.log("========================================");

    if (deployedAddress) {
        console.log(`Deployed ${contractName} found at:`, deployedAddress);
        contract = await ethers.getContractAt(contractName, deployedAddress);
    } else {
        console.log(`No deployed ${contractName} found.`);
    }

    if (!deployer) {
        throw new Error(`Deployer is undefined.`);
    }

    const Factory = (await ethers.getContractFactory(contractName) as ContractFactory).connect(deployer);

    if (isUpgradeable(Factory)) {
        console.log(`${contractName} seems to be upgradeable.`);
    } else {
        console.log(`${contractName} does not seem to be upgradeable.`);
    }

    // What to do?
    {
        const options = ['Upgrade', 'Skip', 'Deploy proxy', 'Deploy bare'];

        const prompt = readlineSync.keyInSelect(
            options,
            `What would you like to do?`,
        );

        const upgradesOpts: DeployProxyOptions = {
            initializer: 'initialize',
            kind: 'uups',
        };

        switch (prompt) {
            case 0:
                console.log(`Upgrading ${contractName}...`);

                if (!deployedAddress) {
                    console.error(`Cannot upgrade ${contractName} without a "deployed" address.`);
                    return deploy({contractName, args, deployer, chainId});
                }

                await upgrades.prepareUpgrade(deployedAddress, Factory, upgradesOpts);

                console.log("Checks passed.")

                contract = await upgrades.upgradeProxy(deployedAddress, Factory, upgradesOpts);

                console.log(`${contractName} upgraded to:`, contract.address);
                break;
            case 1:
                console.log("Skipping...");
                break;
            case 2:
                console.log(`Deploying ${contractName} as proxy with args "${args}"...`);

                contract = await upgrades.deployProxy(
                    Factory,
                    args,
                    upgradesOpts
                );

                console.log(`${contractName} deployed to:`, contract.address);
                break;
            case 3:
                console.log(`Deploying ${contractName} with args "${args}"...`);

                contract = await Factory.deploy(...args);

                await contract.deployed();

                console.log(`${contractName} deployed to:`, contract.address);
                break;
            default:
                process.exit(1);
        }
    }

    if (contract) {
        await report(contract).catch(e => console.log("Error:", e));
        saveAddress(chainId, contractName, contract.address);
    } else {
        throw new Error(`Instance of ${contractName} is undefined.`);
    }

    // Copy ABI to off-chain
    if (saveAbiTo) {
        const artifactsPath = path.join(__dirname, `../artifacts/contracts/${contractName}.sol/${contractName}.json`);
        const abi = require(artifactsPath).abi;

        const outputPath = path.join(__dirname, `${saveAbiTo}/${contractName}/v1/abi.json`);

        try {
            fs.writeFileSync(outputPath, JSON.stringify(abi, null, 2));
            console.log("ABI written to", outputPath);
        } catch (e) {
            console.log("Error writing ABI to", outputPath);
        }

        // Note: to get the most recent commit hash
        // git log --first-parent --max-count=1 --format=%H -- ./off-chain/
    }

    return {contract};
}
