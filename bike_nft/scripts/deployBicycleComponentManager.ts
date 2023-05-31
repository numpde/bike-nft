import {ethers, upgrades} from "hardhat";
import {getAddress} from "ethers/lib/utils";
import {Contract} from "ethers";

import path from "path";
import fs from "fs";

import {execute, getNetworkName} from "../utils/utils";
import {deployed, deploymentParams} from "../deploy.config";
import {saveAddress} from "./utils";


export async function report(contract: Contract) {
    console.log(`Contract here: ${contract.address} by ${contract.deployTransaction?.from}`);

    const proxyAddress = contract.address;
    console.log("Proxy Address:", proxyAddress);

    const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("Impln Address:", implementationAddress);

    // const adminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);
    // console.log("Admin Address:", adminAddress);
}

async function main() {
    const chainId = await ethers.provider.getNetwork().then(network => network.chainId);

    // Get or deploy the managed components contract
    let componentsContract;
    {
        const deployedAddress = deployed[getNetworkName(chainId)]?.BicycleComponents;

        if (deployedAddress) {
            componentsContract = await ethers.getContractAt("BicycleComponents", deployedAddress);
        } else {
            console.log("Deploying BicycleComponents...")

            const BicycleComponents = await ethers.getContractFactory("BicycleComponents");

            componentsContract = await upgrades.deployProxy(
                BicycleComponents,
                [],
                {
                    initializer: 'initialize',
                    kind: 'uups',
                }
            );
        }

        await report(componentsContract).catch(e => console.log("Error:", e));
    }

    // Then get or deploy the manager contract
    let managerContract;
    {
        const deployedAddress = deployed[getNetworkName(chainId)]?.BicycleComponentManager;

        if (deployedAddress) {
            managerContract = await ethers.getContractAt("BicycleComponentManager", deployedAddress);
        } else {
            console.log("Deploying BicycleComponentManager...");

            const BicycleComponentManager = await ethers.getContractFactory("BicycleComponentManager");

            managerContract = await upgrades.deployProxy(
                BicycleComponentManager,
                [],
                {
                    initializer: 'initialize',
                    kind: 'uups',
                }
            );
        }

        await report(managerContract).catch(e => console.log("Error:", e));
    }

    let uiContract: Contract;
    {
        const contractName = "BicycleComponentManagerUI";

        // Copy the ABI from the artifacts.
        {
            const artifactsPath = path.join(__dirname, `../artifacts/contracts/${contractName}.sol/${contractName}.json`);
            const abi = require(artifactsPath).abi;

            const outputPath = path.join(__dirname, `../off-chain/contract-ui/${contractName}/v1/abi.json`);
            fs.writeFileSync(outputPath, JSON.stringify(abi, null, 2));

            // Note: to get the most recent commit hash
            // git log --first-parent --max-count=1 --format=%H -- ./off-chain/
        }

        const deployedAddress = deployed[getNetworkName(chainId)]?.[contractName];
        const baseURI = deploymentParams[getNetworkName(chainId)]?.baseURI?.[contractName] || "";

        if (deployedAddress) {
            uiContract = await ethers.getContractAt(contractName, deployedAddress);
        } else {
            console.log(`Deploying ${contractName}...`);

            const Factory = await ethers.getContractFactory(contractName);

            uiContract = await Factory.deploy(
                managerContract.address,
                ethers.constants.AddressZero,
                baseURI,
            );

            await uiContract.deployed();
        }

        if (uiContract) {
            await report(uiContract).catch(e => console.log("Error:", e));
            saveAddress(chainId, contractName, uiContract.address);
        } else {
            throw new Error(`Instance of ${contractName} is undefined.`);
        }

        if (!((await uiContract.baseURI()) == baseURI)) {
            console.log("Setting base URI...");
            await execute(await uiContract.setBaseURI(baseURI));
        }
    }

    console.log("Linking contracts...");
    {
        if (!(getAddress(await managerContract.nftContractAddress()) == getAddress(componentsContract.address))) {
            console.log("Setting NFT contract address...");
            await execute(await managerContract.setNftContractAddress(componentsContract.address));
        }

        if (!(await componentsContract.hasRole(await componentsContract.NFT_MANAGER_ROLE(), managerContract.address))) {
            console.log("Hiring manager...");
            await execute(await componentsContract.hireManager(managerContract.address));
        }

        if (!(await managerContract.hasRole(await managerContract.REGISTRAR_ROLE(), uiContract.address))) {
            console.log("Registering UI as proxy...");
            await execute(await managerContract.grantRole(await managerContract.REGISTRAR_ROLE(), uiContract.address));
        }
    }
}

if (require.main === module) {
    main().catch(console.error);
}
