function safeRequire(path: string): any | undefined {
    try {
        return require(path);
    } catch (err: any) {
        if (err.code === 'MODULE_NOT_FOUND') {
            console.debug(`safeRequire: No file found at ${path}`);
            return undefined;
        }
        throw err; // Re-throw if it's another error
    }
}

const deploymentParams: {
    [network: string]: {
        baseURI?: {
            [contractName: string]: string;
        };
    };
} = {
    polygon: {
        baseURI: {
            BlanksUI: "https://raw.githubusercontent.com/numpde/bike-nft/main/bike_nft/off-chain/contract-ui/BlanksUI/v1/",
            BicycleComponentManagerUI: "https://raw.githubusercontent.com/numpde/bike-nft/main/bike_nft/off-chain/contract-ui/BicycleComponentManagerUI/v1/",
        },
    },
    mumbai: {
        baseURI: {
            BlanksUI: "https://raw.githubusercontent.com/numpde/bike-nft/main/bike_nft/off-chain/contract-ui/BlanksUI/v1/",
            BicycleComponentManagerUI: "https://raw.githubusercontent.com/numpde/bike-nft/main/bike_nft/off-chain/contract-ui/BicycleComponentManagerUI/v1/",
        },
    },
    ganache: {
        baseURI: {
            BlanksUI: "http://0.0.0.0:6001/contract-ui/BlanksUI/v1/",
            BicycleComponentManagerUI: "http://0.0.0.0:6001/contract-ui/BicycleComponentManagerUI/v1/",
        },
    },
    hardhat: {
        baseURI: {
            BlanksUI: "http://0.0.0.0:6001/contract-ui/BlanksUI/v1/",
            BicycleComponentManagerUI: "http://0.0.0.0:6001/contract-ui/BicycleComponentManagerUI/v1/",
        },
    },
    localhost: {
        baseURI: {
            BlanksUI: "http://0.0.0.0:6001/contract-ui/BlanksUI/v1/",
            BicycleComponentManagerUI: "http://0.0.0.0:6001/contract-ui/BicycleComponentManagerUI/v1/",
        },
    },
}


class DeployedContracts {
    private currentNetwork: string;

    constructor() {
        this.currentNetwork = '';
    }

    // Accessor that returns a Proxy object. When a property is accessed on this object,
    // it sets the current network to the accessed property name, and returns another Proxy object representing the contracts
    public get network() {
        return new Proxy({}, {
            get: (_, networkName: string): any => {
                // Set the current network
                this.currentNetwork = networkName;
                // Return a Proxy object for the contracts
                return this.contract;
            }
        });
    }

    // Accessor that returns a Proxy object. When a property is accessed on this object,
    // it reads the address of the contract with the accessed property name from a JSON file,
    // and returns the address
    private get contract() {
        return new Proxy({}, {
            get: (_, contractName: string): string => {
                const path = `../deployed/network/${this.currentNetwork}/${contractName}.json`;
                // console.log("Getting contract address from", path);
                const contractData = require(path);
                return contractData.address;
            }
        });
    }
}

const deployed = (new DeployedContracts()).network;

export {deployed, deploymentParams};
