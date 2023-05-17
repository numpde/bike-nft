import {ethers, upgrades} from "hardhat";
import {deployed} from "../hardhat.config";

import {getNetworkName} from "../utils/utils";
import {report} from "./deployBicycleComponentManager";


async function main() {
    const chainId = await ethers.provider.getNetwork().then(network => network.chainId);

    const managerContract = await ethers.getContractAt("BicycleComponentManager", deployed[getNetworkName(chainId)].BicycleComponentManager);

    let blanksContract;
    {
        const deployedAddress = deployed[getNetworkName(chainId)]?.BlanksOpenSea;

        if (deployedAddress) {
            blanksContract = await ethers.getContractAt("BlanksOpenSea", deployedAddress);
        } else {
            console.log("Deploying BlanksOpenSea...")

            const BlanksOpenSea = await ethers.getContractFactory("BlanksOpenSea");

            blanksContract = await upgrades.deployProxy(
                BlanksOpenSea,
                [],
                {
                    initializer: 'initialize',
                    kind: 'uups',
                    value: 0,
                }
            );
        }

        await report(blanksContract).catch(e => console.log("Error:", e));
    }

    // Link
    {
        console.log("Linking contracts...");

        await blanksContract.setBicycleComponentManager(managerContract.address);
        await managerContract.grantRole(managerContract.REGISTRAR_ROLE(), blanksContract.address);
    }
}

if (require.main === module) {
    main().catch(console.error);
}
