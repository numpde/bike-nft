import {ethers} from "hardhat";
import {getAddress} from "ethers/lib/utils";

import {execute, getNetworkName, getMostRecent, packJSON} from "../utils/utils";
import {deployed, deploymentParams} from "../deploy.config";
import {ipfsBasePath} from "../hardhat.config";
import {deploy} from "./utils";


async function main() {
    const [deployer] = await ethers.getSigners();
    const chainId = await ethers.provider.getNetwork().then(network => network.chainId);

    const managerContract = await ethers.getContractAt("BicycleComponentManager", deployed[getNetworkName(chainId)].BicycleComponentManager);

    const {contract: blanksContract} = await deploy({
        contractName: "BlanksOpenSea",
        args: [],
        deployer,
        chainId
    });

    const uiBaseURI = deploymentParams[getNetworkName(chainId)]?.baseURI?.["BlanksOpenSea"] || "";

    const {contract: uiContract} = await deploy({
        contractName: "BlanksUI",
        args: [
            blanksContract.address,
            ethers.constants.AddressZero,
            uiBaseURI,
        ],
        chainId,
        deployer,
        saveAbiTo: "../off-chain/contract-ui",
    });

    // Set the base URI if necessary
    if (!((await uiContract.baseURI()) == uiBaseURI)) {
        console.log("Setting base URI...");
        await execute(await uiContract.setBaseURI(uiBaseURI));
    }

    console.log("Linking contracts...");
    {
        if (!(getAddress(await blanksContract.bicycleComponentManager()) == getAddress(managerContract.address))) {
            console.log("Linking BlanksOpenSea to BicycleComponentManager...");
            await execute(await blanksContract.setBicycleComponentManager(managerContract.address));
        } else {
            console.log("BlanksOpenSea already linked to BicycleComponentManager.");
        }

        if (!(await managerContract.hasRole(await managerContract.REGISTRAR_ROLE(), blanksContract.address))) {
            console.log("Granting BlanksOpenSea the registrar role...");
            await execute(await managerContract.grantRole(await managerContract.REGISTRAR_ROLE(), blanksContract.address));
        } else {
            console.log("BlanksOpenSea already has the registrar role.");
        }

        if (!(await blanksContract.hasRole(await blanksContract.PROXY_ROLE(), uiContract.address))) {
            console.log("Registering BlanksUI as proxy for BlanksOpenSea...");
            await execute(await blanksContract.grantRole(await blanksContract.PROXY_ROLE(), uiContract.address));
        } else {
            console.log("BlanksUI already registered as proxy for BlanksOpenSea.");
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
            } else {
                console.log(`URI for token ${tokenId} is already set.`);
            }

            // deployer balance
            const balance = await blanksContract.balanceOf(deployer.address, tokenId);

            if (balance == 0) {
                const amount = isPrivileged ? 1000 : 10_000;
                await execute(await blanksContract.mint(deployer.address, tokenId, amount, "0x"));
            } else {
                console.log(`Token ${tokenId} already minted to ${deployer.address}.`);
            }
        }
    }
}

if (require.main === module) {
    main().catch(console.error);
}
