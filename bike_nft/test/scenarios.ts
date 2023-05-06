import {expect} from "chai";
import {ethers, upgrades} from "hardhat";

async function step00_getAddresses() {
    const [deployer, admin, manager, upgrader, pauser, shop, customer, third] = await ethers.getSigners();
    return {deployer, admin, manager, upgrader, pauser, shop, customer, third};
}

async function step01_deployContracts(deployer) {
    const BicycleComponents = await ethers.getContractFactory("BicycleComponents");
    const BicycleComponentManager = await ethers.getContractFactory("BicycleComponentManager");

    // Deploy the managed NFT contract

    const componentsContract = await upgrades.deployProxy(
        BicycleComponents.connect(deployer),
        [],
        {
            initializer: 'initialize',
            kind: 'uups',
            value: 0,
        }
    );

    // Deploy the manager contract

    const managerContract = await upgrades.deployProxy(
        BicycleComponentManager.connect(deployer),
        [],
        {
            initializer: 'initialize',
            kind: 'uups',
            value: 0,
        }
    );

    return {componentsContract, managerContract};
}

async function step02_linkContracts(deployer, managerContract, componentsContract) {
    // Link the manager contract to the managed contract
    await managerContract.connect(deployer).setNftContractAddress(componentsContract.address);

    // Register the manager contract with the managed contract
    await componentsContract.connect(deployer).hireManager(managerContract.address);
}

async function step03_assignRole(contract, to, role) {
    await contract.grantRole(contract[role](), to.address);
}

async function step04_registerComponent(contract, to, serialNumber, uri) {
    await contract.register(to, serialNumber, uri);
}

describe("Scenarios", function () {
    let snapshotId;

    let componentsContract, managerContract;
    let deployer, admin, manager, upgrader, pauser, shop, customer, third;

    const serialNumber1 = "SN1234567890", uri1 = `Cannondale ${serialNumber1}`;

    beforeEach(async function () {
        if (snapshotId) {
            // Revert the EVM state to the previously saved snapshot
            await ethers.provider.send("evm_revert", [snapshotId]);
        }
    });

    afterEach(async function () {
        // Take a snapshot of the current EVM state
        snapshotId = await ethers.provider.send("evm_snapshot", []);
    });

    // The following `it` blocks share the EVM

    it("Get addresses", async function () {
        ({deployer, admin, manager, upgrader, pauser, shop, customer, third} = await step00_getAddresses());
    });

    it("Setup contracts", async function () {
        ({componentsContract, managerContract} = await step01_deployContracts(deployer));

        await step02_linkContracts(deployer, managerContract, componentsContract);

        await step03_assignRole(managerContract.connect(deployer), admin, "DEFAULT_ADMIN_ROLE");
        await step03_assignRole(managerContract.connect(admin), shop, "MINTER_ROLE");
    });

    it("Basic workflow", async function () {
        await step04_registerComponent(managerContract.connect(shop), customer.address, serialNumber1, uri1);

        const owner = await managerContract.connect(admin).ownerOf(serialNumber1);
        await expect(owner).to.equal(customer.address);
    });
});
