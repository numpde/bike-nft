import {ethers, upgrades} from "hardhat";

async function main() {
    const ContractName = "BicycleComponentV1";

    const Contract = await ethers.getContractFactory(ContractName);

    // https://dev.to/abhikbanerjee99/testing-your-upgradeable-smart-contract-2fjd
    const contract = await upgrades.deployProxy(Contract, [], {
        initializer: 'initialize',
        kind: 'uups',
        value: 0
    });

    console.log(`Contract here: ${contract.address} by ${contract.deployTransaction.from}`);

    const proxyAddress = contract.address;
    console.log("Proxy Address:", proxyAddress);

    const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    console.log("Impln Address:", implementationAddress);

    const adminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);
    console.log("Admin Address:", adminAddress);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
