import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

// suggested by GPT-4 for upgradability
import '@nomiclabs/hardhat-ethers';
import '@openzeppelin/hardhat-upgrades';

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

const config: HardhatUserConfig = {
  solidity: "0.8.18",
  networks: {
    sepolia: {
        url: `https://sepolia.infura.io/v3/${myInfuraApiKey}`,
        accounts: [getEnvVariable("SEPOLIA_10_PRIVATE_KEY")],
    },

    mumbai: {
        url: `https://polygon-mumbai.infura.io/v3/${myInfuraApiKey}`,
        accounts: [getEnvVariable("MUMBAI_10_PRIVATE_KEY")],
    }
  },
};

export default config;
