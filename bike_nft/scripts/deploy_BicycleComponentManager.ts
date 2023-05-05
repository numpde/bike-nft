import {ethers, upgrades} from "hardhat";

async function report(contract) {
    console.log(`Contract here: ${contract.address} by ${contract.deployTransaction.from}`);

    const proxyAddress = contract.address;
    console.log("Proxy Address:", proxyAddress);

    const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("Impln Address:", implementationAddress);

    const adminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);
    console.log("Admin Address:", adminAddress);
}

async function main() {
    // First deploy the managed contract

    const BicycleComponents = await ethers.getContractFactory("BicycleComponents");

    console.log("Deploying BicycleComponents...")

    const componentsContract = await upgrades.deployProxy(BicycleComponents, [], {
        initializer: 'initialize',
        kind: 'uups',
        value: 0
    });

    await report(componentsContract);

    // Then deploy the manager contract

    const BicycleComponentManager = await ethers.getContractFactory("BicycleComponentManager");

    console.log("Deploying BicycleComponentManager...")

    const managerContract = await upgrades.deployProxy(BicycleComponentManager, [], {
        initializer: 'initialize',
        kind: 'uups',
        value: 0
    });

    await report(managerContract);

    // Connect the contracts

    // Link the manager contract to the managed contract
    await managerContract.setNftContractAddress(componentsContract.address);

    // Register the manager contract with the managed contract
    await componentsContract.hireManager(managerContract.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
