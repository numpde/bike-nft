import {ethers, upgrades} from "hardhat";
import {getSigners} from "./signers";
import {expect} from "chai";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {Contract} from "ethers";


export async function deployBicycleComponentsFixture(): Promise<{ contract: Contract }> {
    const {deployer, admin, manager, upgrader, pauser} = await getSigners();

    const Contract = await ethers.getContractFactory("BicycleComponents");

    /**
     * When you deploy a UUPS proxy using `upgrades.deployProxy`, it deploys two contracts:
     *
     * 1. The implementation contract: This is an instance of the contract you provided (in this case, `BicycleComponents`). It contains the actual logic and storage layout of your contract.
     * 2. The proxy contract: This is a separate contract that forwards all calls to the implementation contract while preserving its own storage, enabling upgradeability.
     *
     * In a UUPS (Universal Upgradeable Proxy Standard) deployment, there is no separate admin contract (unlike in a Transparent Proxy deployment). The upgrade authorization mechanism is directly built into the proxy contract, and the upgrade process is managed by the proxy using the functions provided by the `UUPSUpgradeable` contract.
     */

        // https://dev.to/abhikbanerjee99/testing-your-upgradeable-smart-contract-2fjd
    const contract = await upgrades.deployProxy(
            Contract.connect(deployer),
            [],
            {
                initializer: 'initialize',
                kind: 'uups',
            }
        );

    // const proxyAddress = contract.address;
    // console.log("Proxy Address:", proxyAddress);
    //
    // const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    // console.log("Impln Address:", implementationAddress);
    //
    // const adminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);
    // console.log("Admin Address:", adminAddress);

    const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
    await contract.grantRole(DEFAULT_ADMIN_ROLE, admin.address);

    const UPGRADER_ROLE = await contract.UPGRADER_ROLE();
    await contract.grantRole(UPGRADER_ROLE, upgrader.address);

    const NFT_MANAGER_ROLE = await contract.NFT_MANAGER_ROLE();
    await contract.grantRole(NFT_MANAGER_ROLE, manager.address);

    const PAUSER_ROLE = await contract.PAUSER_ROLE();
    await contract.grantRole(PAUSER_ROLE, pauser.address);

    return {contract};
}


export async function deployBicycleComponentManagerFixture() {
    const {deployer, admin, shop1, shop2} = await getSigners();

    // // Deploy the Utils library
    // const {library: utilsLibrary} = await deployUtilsFixture();

    // First deploy the managed contract

    const {contract: componentsContract} = await deployBicycleComponentsFixture();

    // Then deploy the manager contract

    const BicycleComponentManager = await ethers.getContractFactory(
        "BicycleComponentManager",
        {
            libraries: {},
        },
    );

    const managerContract = await upgrades.deployProxy(
        BicycleComponentManager.connect(deployer),
        [],
        {
            initializer: 'initialize',
            kind: 'uups',
        }
    );

    // Link the manager contract to the managed contract
    await managerContract.connect(deployer).setNftContractAddress(componentsContract.address);

    // Register the manager contract with the managed contract
    await componentsContract.connect(deployer).hireManager(managerContract.address);

    // Grant the admin role to the admin
    await managerContract.connect(deployer).grantRole(managerContract.DEFAULT_ADMIN_ROLE(), admin.address);

    // Grant the minter/registrar role to the shops
    await managerContract.connect(admin).grantRole(managerContract.REGISTRAR_ROLE(), shop1.address);
    await managerContract.connect(admin).grantRole(managerContract.REGISTRAR_ROLE(), shop2.address);

    return {componentsContract, managerContract, deployer, admin, shop1, shop2};
}


export async function deployBlanksFixture() {
    const {deployer, admin} = await getSigners();

    const Blanks = await ethers.getContractFactory("BlanksOpenSea");

    const blanksContract = await upgrades.deployProxy(
        Blanks.connect(deployer),
        [],
        {
            initializer: 'initialize',
            kind: 'uups',
        }
    );

    const DEFAULT_ADMIN_ROLE = await blanksContract.DEFAULT_ADMIN_ROLE();

    // Check that the deployer has the admin role
    await expect(await blanksContract.connect(deployer).hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.true;

    // Grant the admin role to the admin
    await blanksContract.connect(deployer).grantRole(DEFAULT_ADMIN_ROLE, admin.address);

    return {blanksContract};
}


export async function deployAllAndLinkFixture() {
    const {componentsContract, managerContract} = await loadFixture(deployBicycleComponentManagerFixture);

    const {blanksContract} = await loadFixture(deployBlanksFixture);
    const {deployer} = await getSigners();

    // link
    await blanksContract.connect(deployer).setBicycleComponentManager(managerContract.address);
    await managerContract.connect(deployer).grantRole(managerContract.REGISTRAR_ROLE(), blanksContract.address);

    return {blanksContract, componentsContract, managerContract};
}
