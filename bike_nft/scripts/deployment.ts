import {Contract, ContractFactory} from "ethers";
import {ethers, upgrades} from "hardhat";
import readlineSync from "readline-sync";

import {deployed} from "../deploy.config";
import {getNetworkName} from "../utils/utils";
import {saveAddress} from "./utils";
import path from "path";
import fs from "fs";


export async function report(contract: Contract) {
    console.log(`Contract here: ${contract.address} by ${contract.deployTransaction?.from}`);

    const proxyAddress = contract.address;
    console.log("Proxy Address:", proxyAddress);

    const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("Impln Address:", implementationAddress);

    // const adminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);
    // console.log("Admin Address:", adminAddress);
}

type DeployParams = { contractName: string, args: any[], deployer: any, chainId: number };

export async function deploy({contractName, args, deployer, chainId}: DeployParams): Promise<{ contract: Contract }> {
    console.log("========================================");

    let contract: Contract | undefined = undefined;

    const deployedAddress = deployed[getNetworkName(chainId)]?.[contractName];
    const Factory = (await ethers.getContractFactory(contractName) as ContractFactory).connect(deployer);

    if (deployedAddress) {
        console.log(`Deployed ${contractName} found at:`, deployedAddress);
        contract = await ethers.getContractAt(contractName, deployedAddress);
    }

    // What to do?
    {
        const options = ['Upgrade', 'Skip', 'Deploy proxy', 'Deploy bare'];

        const prompt = readlineSync.keyInSelect(
            options,
            `The contract ${contractName} has already been deployed. What would you like to do?`,
        );

        switch (prompt) {
            case 0:
                console.log(`Upgrading ${contractName}...`);

                await upgrades.prepareUpgrade(deployedAddress, Factory);

                console.log("Checks passed.")

                contract = await upgrades.upgradeProxy(deployedAddress, Factory);

                console.log(`${contractName} upgraded to:`, contract.address);
                break;
            case 1:
                console.log("Skipping...");
                break;
            case 2:
                console.log(`Deploying ${contractName} as proxy with args ${args}...`);

                contract = await upgrades.deployProxy(
                    Factory,
                    args,
                    {
                        initializer: 'initialize',
                        kind: 'uups',
                    }
                );

                console.log(`${contractName} deployed to:`, contract.address);
                break;
            case 3:
                console.log(`Deploying ${contractName} with args ${args}...`);

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
    {
        const artifactsPath = path.join(__dirname, `../artifacts/contracts/${contractName}.sol/${contractName}.json`);
        const abi = require(artifactsPath).abi;

        const outputPath = path.join(__dirname, `../off-chain/contract-ui/${contractName}/v1/abi.json`);

        try {
            fs.writeFileSync(outputPath, JSON.stringify(abi, null, 2));
        } catch (e) {
            console.log("Error writing ABI to", outputPath);
        }

        // Note: to get the most recent commit hash
        // git log --first-parent --max-count=1 --format=%H -- ./off-chain/
    }

    return {contract};
}
