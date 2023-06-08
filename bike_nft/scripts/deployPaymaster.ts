import {ethers} from "hardhat";

import {execute} from "../utils/utils";
import {deploy} from "./utils";
import {getAddress} from "ethers/lib/utils";


async function main() {
    const [deployer] = await ethers.getSigners();
    const chainId = await ethers.provider.getNetwork().then(network => network.chainId);

    // Get or deploy the managed components contract
    const {contract: opsFundContract} = await deploy({
        contractName: "BicycleComponentOpsFund",
        args: [],
        deployer,
        chainId,
    });

    // Then get or deploy the paymaster
    const {contract: paymasterContract} = await deploy({
        contractName: "BicycleComponentPaymaster",
        args: [],
        deployer,
        chainId,
    });

    console.log("Linking contracts...");
    {
        if (!(getAddress(await paymasterContract.opsFundContractAddress()) == getAddress(opsFundContract.address))) {
            console.log("Setting ops fund contract address...");
            await execute(await paymasterContract.setOpsFundContractAddress(opsFundContract.address));
        } else {
            console.log("Ops fund contract address already set.");
        }

        if (!(await opsFundContract.hasRole(await opsFundContract.PAYMASTER_ROLE(), paymasterContract.address))) {
            console.log("Granting paymaster role...");
            await execute(await opsFundContract.grantRole(await opsFundContract.PAYMASTER_ROLE(), paymasterContract.address));
        } else {
            console.log("Paymaster role already granted.");
        }
    }
}

if (require.main === module) {
    main().catch(console.error);
}
