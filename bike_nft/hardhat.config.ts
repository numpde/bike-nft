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

const myGoerliPrivateKey = getEnvVariable("MY_GOERLI_PRIVATE_KEY");
const myInfuraProjectId = getEnvVariable("MY_INFURA_PROJECT_ID");

const config: HardhatUserConfig = {
  solidity: "0.8.18",
  networks: {
//     goerli: {
//       // Ref: https://docs.infura.io/infura/networks/ethereum/how-to/choose-a-network
//       url: `https://goerli.infura.io/v3/${myInfuraProjectId}`,
//       accounts: [myGoerliPrivateKey],
//     },
  },
};

export default config;
