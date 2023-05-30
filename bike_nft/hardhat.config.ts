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
            url: "http://127.0.0.1:8545",
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



export default config;
