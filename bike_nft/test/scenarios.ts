import {expect} from "chai";
import {ethers, upgrades} from "hardhat";

async function step00_getAddresses() {
    const [deployer, admin, upgrader, pauser, shop1, shop2, customer1, customer2, third] = await ethers.getSigners();
    return {deployer, admin, upgrader, pauser, shop1, shop2, customer1, customer2, third};
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
    let deployer, admin, upgrader, pauser, shop1, shop2, customer1, customer2, third;

    const serialNumber1 = "SN-12345678", uri1 = `Cannondale ${serialNumber1}`;
    const serialNumber2 = "SN-23456789", uri2 = `Campagnolo ${serialNumber2}`;

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
        ({deployer, admin, upgrader, pauser, shop1, shop2, customer1, customer2, third} = await step00_getAddresses());
    });

    it("Setup contracts", async function () {
        ({componentsContract, managerContract} = await step01_deployContracts(deployer));

        await step02_linkContracts(deployer, managerContract, componentsContract);

        await step03_assignRole(managerContract.connect(deployer), admin, "DEFAULT_ADMIN_ROLE");
        await step03_assignRole(managerContract.connect(admin), shop1, "MINTER_ROLE");
        await step03_assignRole(managerContract.connect(admin), shop2, "MINTER_ROLE");
    });

    it("Bicycle component registration 1", async function () {
        // A shop registers a bicycle component to a customer
        await step04_registerComponent(managerContract.connect(shop1), customer1.address, serialNumber1, uri1);

        // Check
        const owner = await managerContract.connect(admin).ownerOf(serialNumber1);
        await expect(owner).to.equal(customer1.address);
    });

    it("Bicycle component registration 2", async function () {
        // Another shop registers another bicycle component to another customer
        await step04_registerComponent(managerContract.connect(shop2), customer2.address, serialNumber2, uri2);

        // Check
        const owner = await managerContract.connect(admin).ownerOf(serialNumber2);
        await expect(owner).to.equal(customer2.address);
    });
});
