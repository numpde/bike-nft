import {ethers} from "hardhat";
import {getAddress} from "ethers/lib/utils";

import {execute, getNetworkName} from "../utils/utils";
import {deploymentParams} from "../deploy.config";
import {deploy} from "./deployment";


async function main() {
    const chainId = await ethers.provider.getNetwork().then(network => network.chainId);
    const [deployer] = await ethers.getSigners();

    // Get or deploy the managed components contract
    const {contract: componentsContract} = await deploy({
        contractName: "BicycleComponents",
        args: [],
        deployer,
        chainId
    });

    // Then get or deploy the manager contract
    const {contract: managerContract} = await deploy({
        contractName: "BicycleComponentManager",
        args: [],
        deployer,
        chainId
    });

    const uiBaseURI = deploymentParams[getNetworkName(chainId)]?.baseURI?.["BicycleComponentManagerUI"] || "";

    const {contract: uiContract} = await deploy({
        contractName: "BicycleComponentManagerUI",
        args: [
            managerContract.address,
            ethers.constants.AddressZero,
            uiBaseURI
        ],
        chainId,
        deployer,
    });

    // Set the base URI if necessary
    if (!((await uiContract.baseURI()) == uiBaseURI)) {
        console.log("Setting base URI...");
        await execute(await uiContract.setBaseURI(uiBaseURI));
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

        if (!(await managerContract.hasRole(await managerContract.UI_ROLE(), uiContract.address))) {
            console.log("Registering UI...");
            await execute(await managerContract.grantRole(await managerContract.UI_ROLE(), uiContract.address));
        }
    }
}

if (require.main === module) {
    main().catch(console.error);
}
