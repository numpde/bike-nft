import {ethers, upgrades} from "hardhat";
import {deployed, ipfsBasePath} from "../hardhat.config";

import {execute, getNetworkName, getMostRecent, packJSON} from "../utils/utils";
import {report} from "./deployBicycleComponentManager";
import {getAddress} from "ethers/lib/utils";


async function main() {
    const [deployer] = await ethers.getSigners();
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

        if (getAddress(await blanksContract.bicycleComponentManager()) != getAddress(managerContract.address)) {
            console.log("Linking BlanksOpenSea to BicycleComponentManager...");
            await execute(await blanksContract.setBicycleComponentManager(managerContract.address));
        }

        if (!(await managerContract.hasRole(managerContract.REGISTRAR_ROLE(), blanksContract.address))) {
            console.log("Granting BlanksOpenSea registrar role...");
            await execute(await managerContract.grantRole(managerContract.REGISTRAR_ROLE(), blanksContract.address));
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

            const ipfsImageHash = imageManifest.files.find(x => (authority == x.Name));

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
