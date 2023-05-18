import {ethers, upgrades} from "hardhat";
import {deployed, ipfsBasePath} from "../hardhat.config";

import {execute, getNetworkName, getMostRecent, packJSON} from "../utils/utils";
import {report} from "./deployBicycleComponentManager";


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

        if (await blanksContract.bicycleComponentManager() != managerContract.address) {
            console.log("Linking BlanksOpenSea to BicycleComponentManager...");
            await execute(await blanksContract.setBicycleComponentManager(managerContract.address));
        }

        if (!await managerContract.hasRole(managerContract.REGISTRAR_ROLE(), blanksContract.address)) {
            console.log("Granting BlanksOpenSea registrar role...");
            await execute(await managerContract.grantRole(managerContract.REGISTRAR_ROLE(), blanksContract.address));
        }
    }

    // URIs
    {
        console.log("Setting URIs...");

        const image_manifest = await getMostRecent("data/*blanks_nft_image/manifest*.json");

        const metadata = {
            "name": "Blank NFT",
            "description": "To register your bike, use the contract's `register` function.",
            "image": `${ipfsBasePath}${image_manifest.files[0].Hash}`,
        }

        const uri = packJSON(metadata);

        const TOKEN_ID = blanksContract.MY_BLANK_NFT_TOKEN_ID();
        await execute(await blanksContract.setCustomTokenURI(TOKEN_ID, uri));
    }
}

if (require.main === module) {
    main().catch(console.error);
}
