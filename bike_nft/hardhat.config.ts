import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

// Load environment variables
import * as dotenv from "dotenv";
dotenv.config();

// Helper function to assert environment variables and provide a descriptive error message
function getEnvVariable(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

// Get private key and Infura project ID from the environment variables
const privateKey = getEnvVariable("PRIVATE_KEY");
const infuraProjectId = getEnvVariable("INFURA_PROJECT_ID");

const config: HardhatUserConfig = {
  solidity: "0.8.18",
  networks: {
    rinkeby: {
      url: `https://rinkeby.infura.io/v3/${infuraProjectId}`,
      accounts: [privateKey],
    },
  },
};

export default config;
