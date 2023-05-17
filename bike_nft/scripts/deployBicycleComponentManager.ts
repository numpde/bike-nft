import {ethers, upgrades} from "hardhat";
import {deployed} from "../hardhat.config";
import {getNetworkName} from "../utils/utils";

export async function report(contract) {
    console.log(`Contract here: ${contract.address} by ${contract.deployTransaction?.from}`);

    const proxyAddress = contract.address;
    console.log("Proxy Address:", proxyAddress);

    const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("Impln Address:", implementationAddress);

    const adminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);
    console.log("Admin Address:", adminAddress);
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
                    value: 0,
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
                    value: 0,
                }
            );
        }

        await report(componentsContract).catch(e => console.log("Error:", e));
    }

    // Connect the contracts
    {
        // Link the manager contract to the managed contract
        await managerContract.setNftContractAddress(componentsContract.address);

        // Register the manager contract with the managed contract
        await componentsContract.hireManager(managerContract.address);
    }
}

if (require.main === module) {
    main().catch(console.error);
}
