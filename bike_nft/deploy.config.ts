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
        BicycleComponentManager: "0x7ba471Ea78a94f180605165db6D11E38A831175B",
        BicycleComponents: "0xA7Dc946c20166416CA7a880cCa79157c55d8966C",
        BlanksOpenSea: "0xC612Aa2A6721a02f23Fe5d9e19613cc1B1C99B56",
        BlanksUI: "",
    },
};

export {deployed, deploymentParams};