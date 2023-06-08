import {ethers} from "hardhat";
import {getAddress} from "ethers/lib/utils";

import {execute, getNetworkName} from "../utils/utils";
import {deploymentParams} from "../deploy.config";
import {deploy} from "./deployment";


async function main() {
    const chainId = await ethers.provider.getNetwork().then(network => network.chainId);
    const [deployer] = await ethers.getSigners();

    // Get or deploy the managed components contract
    const {contract: opsFundContract} = await deploy({
        contractName: "BicycleComponentOpsFund",
        args: [],
        deployer,
        chainId
    });

}

if (require.main === module) {
    main().catch(console.error);
}
