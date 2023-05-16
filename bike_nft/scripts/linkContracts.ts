import {deployed} from "../hardhat.config";
import {ethers} from "hardhat";

function getNetworkName(chainId: number): string {
    switch (chainId) {
        case 137:
            return 'polygon';
        case 1337:
            return 'ganache';
        case 80001:
            return 'mumbai';
        default:
            return 'unknown';
    }
}

// async function verifyContract(contractAddress, contractFactory) {
//     const contract = await ethers.getContractAt(contractFactory.interface, contractAddress);
//     const candidateCode = await ethers.provider.getCode(contractAddress);
//
//     const referenceCode = contractFactory.bytecode;
//
//     if (candidateCode === referenceCode) {
//         console.log(`Contract verified: ${contractAddress}`);
//     } else {
//         console.log("Reference code:", referenceCode);
//         console.log("Candidate code:", candidateCode);
//         throw new Error(`Contract verification failed: ${contractAddress}`);
//     }
//
//     return contract;
// }

async function execute(tx) {
    console.log(`Transaction hash: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`Transaction status: ${receipt.status}`);
}

async function main() {
    const [deployer] = await ethers.getSigners();
    const chainId = await deployer.getChainId();

    const managerContractAddress = deployed[getNetworkName(chainId)]?.BicycleComponentManager;
    const componentsContractAddress = deployed[getNetworkName(chainId)]?.BicycleComponents;

    if (!managerContractAddress) {
        throw new Error("BicycleComponentManager address not found");
    }

    if (!componentsContractAddress) {
        throw new Error("BicycleComponents address not found");
    }

    const managerContract = await ethers.getContractAt("BicycleComponentManager", managerContractAddress);
    const componentsContract = await ethers.getContractAt("BicycleComponents", componentsContractAddress);

    await execute(await managerContract.connect(deployer).setNftContractAddress(componentsContract.address));
    await execute(await componentsContract.connect(deployer).hireManager(managerContract.address));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
