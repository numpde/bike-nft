const deploymentParams: {
    [network: string]: {
        baseURI?: {
            [contractName: string]: string;
        };
    };
} = {
    polygon: {},
    mumbai: {},
    ganache: {
        baseURI: {
            BlanksUI: "http://0.0.0.0:6001/contract-ui/BlanksUI/v1/",
        },
    },
    hardhat: {
        baseURI: {
            BlanksUI: "http://0.0.0.0:6001/contract-ui/BlanksUI/v1/",
        },
    },
}

const deployed: {
    [network: string]: {
        [contractName: string]: string;
    };
} = {
    polygon: {
        BicycleComponentManager: "0xd7334783B80B31Cf039fE615169B1f513d8d84ED",
        BicycleComponents: "0x8DdF2e56DbBE7cF86e6cC2EA2c473Ca66654dCAA",
        BlanksOpenSea: "0xa5a281d3EE4840c984d82e7B8fe4E28800D38655",
    },
    mumbai: {
        BicycleComponentManager: "0x5aec9a71fd38a6234ce6a2fade9b693dd8466c9b",
        BicycleComponents: "0x52b371e38cdcd877e347e45d7d231f384d68599c",
        BlanksOpenSea: "0x025b85a56c9b495785171c64c44a65f0abfe1e7c",
    },
    ganache: {
        BicycleComponentManager: "0xa0cE34473EC9FC0F50AD11b00377dBd48F4BBdd6",
        BicycleComponents: "0x9592eC44622Ff441561F388a6CCc6D3e67B5fBF2",
        BlanksOpenSea: "0x5C73d17D1ee8B83A547faC4F3c17B6A5216F0985",
    },
};

export {deployed, deploymentParams};
