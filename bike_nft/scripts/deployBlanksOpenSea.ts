import {ethers, upgrades} from "hardhat";
import readlineSync from "readline-sync";
import {Contract} from "ethers";

import {ipfsBasePath} from "../hardhat.config";
import {execute, getNetworkName, getMostRecent, packJSON} from "../utils/utils";
import {report} from "./deployBicycleComponentManager";
import {getAddress} from "ethers/lib/utils";
import {deployed, deploymentParams} from "../deploy.config";

import path from 'path';
import fs from "fs";

function saveAddress(chainId: number, contractName: string, address: string) {
    const networkName = getNetworkName(chainId);
    const outputPath = path.join(__dirname, `../../deployed/network/${networkName}/${contractName}.json`);
    fs.writeFileSync(outputPath, JSON.stringify({address: address, network: chainId}, null, 4));
}

async function main() {
    const [deployer] = await ethers.getSigners();
    const chainId = await ethers.provider.getNetwork().then(network => network.chainId);

    const managerContract = await ethers.getContractAt("BicycleComponentManager", deployed[getNetworkName(chainId)].BicycleComponentManager);

    let blanksContract: Contract | undefined = undefined;
    {
        const contractName = "BlanksOpenSea";
        const deployedAddress = deployed[getNetworkName(chainId)]?.[contractName];

        if (deployedAddress) {
            blanksContract = await ethers.getContractAt(contractName, deployedAddress);

            const prompt = readlineSync.keyInSelect(['Yes', 'No'], 'The contract BlanksOpenSea has already been deployed. Would you like to upgrade it?');

            switch (prompt) {
                case 0:
                    console.log("Upgrading BlanksOpenSea...");

                    const Factory = await ethers.getContractFactory(contractName);
                    blanksContract = await upgrades.upgradeProxy(deployedAddress, Factory);

                    console.log(`${contractName} upgraded to:`, blanksContract.address);
                    break;
                case 1:
                    console.log("Skipping...");
                    break;
                default:
                    process.exit(1);
            }
        } else {
            const prompt = readlineSync.keyInSelect(['Yes'], 'No deployed contract BlanksOpenSea found. Would you like to deploy a new one?');

            switch (prompt) {
                case 0:
                    console.log("Deploying BlanksOpenSea...");

                    const Factory = await ethers.getContractFactory(contractName);

                    blanksContract = await upgrades.deployProxy(
                        Factory,
                        [],
                        {
                            initializer: 'initialize',
                            kind: 'uups',
                        }
                    );

                    console.log("BlanksOpenSea deployed to:", blanksContract.address);
                    break;
                default:
                    process.exit(1);
            }
        }

        if (blanksContract) {
            await report(blanksContract).catch(e => console.log("Error:", e));
            saveAddress(chainId, contractName, blanksContract.address);
        } else {
            throw new Error(`Instance of ${contractName} is undefined.`);
        }
    }

    let blanksUiContract: Contract;
    {
        const contractName = "BlanksUI";
        const deployedAddress = deployed[getNetworkName(chainId)]?.[contractName];

        if (deployedAddress) {
            blanksUiContract = await ethers.getContractAt(contractName, deployedAddress);
        } else {
            console.log(`Deploying ${contractName}...`);

            const Factory = await ethers.getContractFactory(contractName);

            blanksUiContract = await Factory.deploy(
                blanksContract.address,
                ethers.constants.AddressZero,
                deploymentParams[getNetworkName(chainId)]?.baseURI?.BlanksUI || "",
            );

            await blanksUiContract.deployed();
        }

        if (blanksUiContract) {
            await report(blanksUiContract).catch(e => console.log("Error:", e));
            saveAddress(chainId, contractName, blanksUiContract.address);
        } else {
            throw new Error(`Instance of ${contractName} is undefined.`);
        }
    }

    // "Upload" the blanksUiContract ABI
    {
        const abi = blanksUiContract.interface.fragments;
        const outputPath = path.join(__dirname, `../off-chain/contract-ui/BlanksUI/v1/abi.json`);
        fs.writeFileSync(outputPath, JSON.stringify(abi, null, 2));
    }

    // Link
    {
        console.log("Linking contracts...");

        if (getAddress(await blanksContract.bicycleComponentManager()) != getAddress(managerContract.address)) {
            console.log("Linking BlanksOpenSea to BicycleComponentManager...");
            await execute(await blanksContract.setBicycleComponentManager(managerContract.address));
        }

        if (!(await managerContract.hasRole(await managerContract.REGISTRAR_ROLE(), blanksContract.address))) {
            console.log("Granting BlanksOpenSea the registrar role...");
            await execute(await managerContract.grantRole(await managerContract.REGISTRAR_ROLE(), blanksContract.address));
        }

        if (!(await blanksContract.hasRole(await blanksContract.PROXY_ROLE(), blanksUiContract.address))) {
            console.log("Registering BlanksUI as proxy for BlanksOpenSea...");
            await execute(await blanksContract.grantRole(await blanksContract.PROXY_ROLE(), blanksUiContract.address));
        }
    }

    // URIs and minting
    {
        console.log("Setting URIs and minting...");

        const imageManifest = await getMostRecent("data/*blanks_nft_image/manifest*.json");

        const authorities = ["A", "B", "C", "D"];

        for (const authority of authorities) {
            const tokenId = await blanksContract[`BLANK_NFT_TOKEN_ID_${authority}`]();
            const isPrivileged = await blanksContract.isPrivilegedToken(tokenId);

            const description = isPrivileged ?
                "To register a bike, use the contract's `register` function. This NFT is generally non-transferable." :
                "To register your bike, use the contract's `register` function.";

            const ipfsImageHash = imageManifest.files.find((x: any) => (authority == x.Name));

            const metadata = {
                "name": `Blank NFT (${authority})`,
                "description": description,
                "image": `${ipfsBasePath}${ipfsImageHash.Hash}`,
            };

            const uri = await packJSON(metadata);

            if ((await blanksContract.uri(tokenId)) != uri) {
                await execute(await blanksContract.setCustomTokenURI(tokenId, uri));
            }

            // deployer balance
            const balance = await blanksContract.balanceOf(deployer.address, tokenId);

            if (balance == 0) {
                const amount = isPrivileged ? 1000 : 10_000;
                await execute(await blanksContract.mint(deployer.address, tokenId, amount, "0x"));
            }
        }
    }
}

if (require.main === module) {
    main().catch(console.error);
}
