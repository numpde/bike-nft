import {HardhatUserConfig} from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

// suggested by GPT-4 for upgradability
import '@nomiclabs/hardhat-ethers';
import '@openzeppelin/hardhat-upgrades';

// https://cryptodevops.academy/automatically-calculate-the-size-of-a-solidity-smart-contract-with-hardhat-contract-sizer-905f1077442d
require('hardhat-contract-sizer');

// Load environment variables
import * as dotenv from "dotenv";

dotenv.config();

function getEnvVariable(name: string): string {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Missing environment variable: ${name}`);
    }

    return value;
}

const myInfuraApiKey = getEnvVariable("INFURA_API_KEY");
export const ipfsBasePath = getEnvVariable("IPFS_BASE_PATH");

const config: HardhatUserConfig = {
    solidity: {
        version: "0.8.18",
        settings: {
            optimizer: {
                enabled: true,
                runs: 100,
            },
        },
    },

    paths: {
        sources: "./contracts",
    },


    etherscan: {
        apiKey: {
            polygonMumbai: getEnvVariable("POLYGONSCAN_API_KEY"),
            polygon: getEnvVariable("POLYGONSCAN_API_KEY"),
        }
    },

    networks: {
        ganache: {
            url: "HTTP://127.0.0.1:7545",
            accounts: [getEnvVariable("GANACHE_PRIVATE_KEY")],
        },

        sepolia: {
            url: `https://sepolia.infura.io/v3/${myInfuraApiKey}`,
            accounts: [getEnvVariable("SEPOLIA_10_PRIVATE_KEY")],
        },

        mumbai: {
            url: `https://polygon-mumbai.infura.io/v3/${myInfuraApiKey}`,
            accounts: [getEnvVariable("MUMBAI_10_PRIVATE_KEY")],
        },

        polygon: {
            url: `https://polygon-mainnet.infura.io/v3/${myInfuraApiKey}`,
            accounts: [getEnvVariable("BIKE_DEPLOYER_POLYGON_PRIVATE_KEY")],
        },
    },
};


const deployed = {
    polygon: {
        BicycleComponentManager: "0xd7334783B80B31Cf039fE615169B1f513d8d84ED",
        BicycleComponents: "0x8DdF2e56DbBE7cF86e6cC2EA2c473Ca66654dCAA",
    },
    mumbai: {
        BicycleComponentManager: "0x5aec9a71fd38a6234ce6a2fade9b693dd8466c9b",
        BicycleComponents: "0x52b371e38cdcd877e347e45d7d231f384d68599c",
        BlanksOpenSea: "0x3caA6445BCc33750791d587B0995c4063E80B326",
    },
    ganache: {
        BicycleComponentManager: "0xa0cE34473EC9FC0F50AD11b00377dBd48F4BBdd6",
        BicycleComponents: "0x9592eC44622Ff441561F388a6CCc6D3e67B5fBF2",
        BlanksOpenSea: "0x50C2e59E4059aBeeEf98960C9c44a5f56Bf2d8f0",
    },
};

export default config;
export {deployed};
