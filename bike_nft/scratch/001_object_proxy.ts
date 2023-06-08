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
                const contractData = require(`../deployed/network/${this.currentNetwork}/${contractName}.json`);
                return contractData.address;
            }
        });
    }
}

const proxy = new DeployedContracts();
console.log(proxy.network?.["mainnet"]?.["TokenName"]); // Outputs the address of the "TokenName" contract on the "mainnet" network
