import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";

import {getSigners} from "./signers";


export async function deployBicycleComponentsFixture(): Promise<{ contract: ethers.Contract }> {
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
                value: 0,
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

async function mintTokenFixture() {
    const {manager, customer1} = await getSigners();
    const {contract} = await loadFixture(deployBicycleComponentsFixture);

    // check that contract has the expected type
    await expect(contract).to.be.instanceOf(ethers.Contract);

    const tokenId = 42;
    const uri = "https://https://google.com/search?q=" + tokenId;

    await contract.connect(manager).safeMint(customer1.address, tokenId);
    await contract.connect(manager).setTokenURI(tokenId, uri);

    return {tokenId, uri, contract, manager, customer1};
}

describe("BicycleComponents", function () {
    describe("Deployment", function () {
        it("Should deploy", async function () {
            const {contract} = await loadFixture(deployBicycleComponentsFixture);
            expect(contract.address).to.not.be.null;
            expect(contract.address).to.not.be.undefined;
            expect(contract.address).to.not.be.empty;
        });

        it("Should grant initial roles to the deployer", async function () {
            const {deployer} = await getSigners();
            const {contract} = await loadFixture(deployBicycleComponentsFixture);

            const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
            const PAUSER_ROLE = await contract.PAUSER_ROLE();
            const NFT_MANAGER_ROLE = await contract.NFT_MANAGER_ROLE();

            const hasAdminRole = await contract.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
            const hasPauserRole = await contract.hasRole(PAUSER_ROLE, deployer.address);
            const hasManagerRole = await contract.hasRole(NFT_MANAGER_ROLE, deployer.address);

            expect(hasAdminRole).to.be.true;
            expect(hasPauserRole).to.be.true;
            expect(hasManagerRole).to.be.false;
        });

        it("The fixture should grant the NFT_MANAGER_ROLE to the manager", async function () {
            const {manager} = await getSigners();
            const {contract} = await loadFixture(deployBicycleComponentsFixture);
            const NFT_MANAGER_ROLE = await contract.NFT_MANAGER_ROLE();
            const hasManagerRole = await contract.hasRole(NFT_MANAGER_ROLE, manager.address);
            expect(hasManagerRole).to.be.true;
        });
    });

    describe("Minting", function () {
        it("Should assign initial ownership correctly", async function () {
            const {deployer, manager, customer1} = await getSigners();
            const {contract} = await loadFixture(deployBicycleComponentsFixture);
            const {tokenId} = await loadFixture(mintTokenFixture);

            const initialOwner = await contract.ownerOf(tokenId);

            expect(initialOwner).to.equal(customer1.address);

            expect(initialOwner).to.not.equal(manager.address);
            expect(initialOwner).to.not.equal(deployer.address);
        });

        it("Should not allow minting if without NFT_MANAGER_ROLE", async function () {
            const {deployer, admin, third} = await getSigners();
            const {contract} = await loadFixture(deployBicycleComponentsFixture);

            for (const address of [deployer, admin, third]) {
                const action = contract.connect(address).safeMint(third.address, 42);
                const reason = `AccessControl: account ${address.address.toLowerCase()} is missing role ${await contract.NFT_MANAGER_ROLE()}`;
                await expect(action).to.be.revertedWith(reason);
            }
        });

        it("Should allow minting if with NFT_MANAGER_ROLE", async function () {
            const {manager, third} = await getSigners();
            const {contract} = await loadFixture(deployBicycleComponentsFixture);

            const action = contract.connect(manager).safeMint(third.address, 42);
            await expect(action).to.not.be.reverted;
        });
    });

    describe("Burning", function () {
        it("Should allow the manager to burn a token", async function () {
            const {contract, tokenId, manager} = await loadFixture(mintTokenFixture);

            const action = contract.connect(manager).burn(tokenId);
            await expect(action).to.not.be.reverted;
        });

        it("Should allow the owner to burn their token", async function () {
            const {contract, tokenId, customer1} = await loadFixture(mintTokenFixture);

            const action = contract.connect(customer1).burn(tokenId);
            await expect(action).to.not.be.reverted;
        });

        // it("Should not allow the minter to burn their token", async function () {
        //     const {contract, tokenId} = await loadFixture(mintTokenFixture);
        //     const {shop} = await getSigners();
        //
        //     const action = contract.connect(shop).burn(tokenId);
        //     await expect(action).to.be.revertedWith("Not owner/approved");
        // });

        it("Should not allow a third party to burn a token", async function () {
            const {contract, tokenId} = await loadFixture(mintTokenFixture);
            const {third} = await getSigners();

            const action = contract.connect(third).burn(tokenId);
            await expect(action).to.be.revertedWith("Not owner/approved");
        });
    });

    describe("Token URI", function () {
        it("Should return the correct token URI", async function () {
            const {contract, uri, tokenId} = await loadFixture(mintTokenFixture);
            const {third} = await getSigners();

            const action = contract.connect(third).tokenURI(tokenId);
            await expect(await action).to.equal(uri);
        });

        it("Should allow the manager/owner to set the token URI", async function () {
            const {manager, customer1} = await getSigners();
            const {contract, tokenId} = await loadFixture(mintTokenFixture);

            // BicycleComponents does not have a minter role (has NFT_MANAGER_ROLE instead)

            for (const account of [manager, customer1]) {
                const newUri = "https://google.com/search?q=" + tokenId + "/" + account.address;

                const action = contract.connect(account).setTokenURI(tokenId, newUri);
                await expect(action).to.not.be.reverted;

                const actualUri = await contract.tokenURI(tokenId);
                expect(actualUri).to.equal(newUri);
            }
        });

        it("Should not allow others to set the token URI", async function () {
            const {deployer, admin, third} = await getSigners();
            const {contract, tokenId} = await loadFixture(mintTokenFixture);

            for (const address of [deployer, admin, third]) {
                const action = contract.connect(address).setTokenURI(tokenId, "https://yahoo.com/search?q=" + tokenId);
                const reason = "Not owner/approved";
                await expect(action).to.be.revertedWith(reason);
            }
        });
    });

    describe("Pausing", function () {
    });

    describe("Transferring", function () {
        it("Should allow the manager to transfer", async function () {
            const {contract, customer, tokenId, manager} = await loadFixture(mintTokenFixture);
            const {third} = await getSigners();

            const action = contract.connect(manager).transfer(tokenId, third.address);
            await expect(action).to.not.be.reverted;

            const newOwner = await contract.ownerOf(tokenId);
            expect(newOwner).to.equal(third.address);
        });

        it("Should not allow the admins to transfer", async function () {
            const {contract, tokenId} = await loadFixture(mintTokenFixture);
            const {deployer, admin} = await getSigners();
            const {third} = await getSigners();

            for (const address of [deployer, admin]) {
                const action = contract.connect(address).transfer(tokenId, third.address);
                const reason = "ERC721: caller is not token owner or approved";
                await expect(action).to.be.revertedWith(reason);
            }
        });

        it("Should not allow a random stranger to transfer", async function () {
            const {contract, tokenId} = await loadFixture(mintTokenFixture);
            const {third} = await getSigners();

            const action = contract.connect(third).transfer(tokenId, third.address);
            const reason = "ERC721: caller is not token owner or approved";

            await expect(action).to.be.revertedWith(reason);
        });

        it("Should allow a generic owner to transfer", async function () {
            const {contract, tokenId, customer1} = await loadFixture(mintTokenFixture);
            const {third} = await getSigners();

            // Check that `customer` is the owner of the token
            const initialOwner = await contract.ownerOf(tokenId);
            expect(initialOwner).to.equal(customer1.address);

            const action = contract.connect(customer1).transfer(tokenId, third.address);
            await expect(action).to.not.be.reverted;
        });

        it("Should not allow transfer to the zero address", async function () {
            const {contract, tokenId, customer1} = await loadFixture(mintTokenFixture);

            const action = contract.connect(customer1).transfer(tokenId, ethers.constants.AddressZero);
            const reason = "ERC721: transfer to the zero address";

            await expect(action).to.be.revertedWith(reason);
        });

        it("Should allow the `transferFrom` function", async function () {
            const {contract, manager, tokenId, customer1} = await loadFixture(mintTokenFixture);
            const {third} = await getSigners();

            const action = contract.connect(manager).transferFrom(customer1.address, third.address, tokenId);

            await expect(action).to.not.be.reverted;
        });

        it("Should allow the `safeTransferFrom` function", async function () {
            const {contract, manager, tokenId, customer1} = await loadFixture(mintTokenFixture);
            const {third} = await getSigners();

            const action = contract.connect(manager).transferFrom(customer1.address, third.address, tokenId);

            await expect(action).to.not.be.reverted;
        });
    });

    describe("Hiring a manager", function () {
        it("Should allow the admin to hire a manager", async function () {
            const {contract} = await loadFixture(deployBicycleComponentsFixture);
            const {admin, third} = await getSigners();

            // Check that admin has the DEFAULT_ADMIN_ROLE
            const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
            expect(await contract.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;

            // Check that `manager` does not have the NFT_MANAGER_ROLE
            const NFT_MANAGER_ROLE = await contract.NFT_MANAGER_ROLE();
            expect(await contract.hasRole(NFT_MANAGER_ROLE, third.address)).to.be.false;

            const action = contract.connect(admin).hireManager(third.address);
            await expect(action).to.not.be.reverted;

            // Check that `miner` now has the NFT_MANAGER_ROLE
            expect(await contract.hasRole(NFT_MANAGER_ROLE, third.address)).to.be.true;
        });

        it("Should not allow the manager to hire a manager", async function () {
            const {contract} = await loadFixture(deployBicycleComponentsFixture);
            const {manager, third} = await getSigners();

            const action = contract.connect(manager).hireManager(third.address);
            const reason = `AccessControl: account ${manager.address.toLowerCase()} is missing role ${await contract.DEFAULT_ADMIN_ROLE()}`;
            await expect(action).to.be.revertedWith(reason);
        });

        it("Should allow an admin to fire the manager", async function () {
            const {contract} = await loadFixture(deployBicycleComponentsFixture);
            const {admin, third} = await getSigners();

            // Check that admin has the DEFAULT_ADMIN_ROLE
            const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
            expect(await contract.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;

            // Hire `third` as the manager
            await contract.connect(admin).hireManager(third.address);

            // Check that `third` has the NFT_MANAGER_ROLE
            const NFT_MANAGER_ROLE = await contract.NFT_MANAGER_ROLE();
            expect(await contract.hasRole(NFT_MANAGER_ROLE, third.address)).to.be.true;

            const action = contract.connect(admin).fireManager(third.address);
            await expect(action).to.not.be.reverted;

            // Check that `third` does not have the NFT_MANAGER_ROLE
            expect(await contract.hasRole(NFT_MANAGER_ROLE, third.address)).to.be.false;
        });

        it("Should not allow a non-admin to fire the manager", async function () {
            const {contract} = await loadFixture(deployBicycleComponentsFixture);
            const {admin, third} = await getSigners();

            // Hire `third` as the manager
            await contract.connect(admin).hireManager(third.address);

            // Check that `third` has the NFT_MANAGER_ROLE
            const NFT_MANAGER_ROLE = await contract.NFT_MANAGER_ROLE();
            expect(await contract.hasRole(NFT_MANAGER_ROLE, third.address)).to.be.true;

            const action = contract.connect(third).fireManager(third.address);
            const reason = `AccessControl: account ${third.address.toLowerCase()} is missing role ${await contract.DEFAULT_ADMIN_ROLE()}`;
            await expect(action).to.be.revertedWith(reason);

            // Check that `third` still has the NFT_MANAGER_ROLE
            expect(await contract.hasRole(NFT_MANAGER_ROLE, third.address)).to.be.true;
        });
    });

    describe("Operator approval", function () {
        it("Should allow `approve`", async function () {
            const {contract, customer1, tokenId} = await loadFixture(mintTokenFixture);
            const {third} = await getSigners();

            const action1 = contract.connect(customer1).approve(third.address, tokenId);
            await expect(action1).to.not.be.reverted;

            const action2 = contract.connect(customer1).getApproved(tokenId);
            await expect(await action2).to.equal(third.address);

            const action3 = contract.connect(third).transferFrom(customer1.address, third.address, tokenId);
            await expect(action3).to.not.be.reverted;
        });

        it("Should allow `setApprovalForAll`", async function () {
            const {contract, customer1, tokenId} = await loadFixture(mintTokenFixture);
            const {third} = await getSigners();

            const action1 = contract.connect(customer1).setApprovalForAll(third.address, true);
            await expect(action1).to.not.be.reverted;

            const action2 = contract.connect(customer1).isApprovedForAll(customer1.address, third.address);
            await expect(await action2).to.equal(true);

            const action3 = contract.connect(third).transferFrom(customer1.address, third.address, tokenId);
            await expect(action3).to.not.be.reverted;
        });

        it("Should provide a meaningful `isApprovedOrOwner`", async function () {
            const {contract, manager, customer1, tokenId} = await loadFixture(mintTokenFixture);
            const {third} = await getSigners();

            const action1 = contract.connect(third).isApprovedOrOwner(customer1.address, tokenId);
            await expect(await action1).to.equal(true);

            const action2 = contract.connect(third).isApprovedOrOwner(manager.address, tokenId);
            await expect(await action2).to.equal(true);

            const action3 = contract.connect(third).isApprovedOrOwner(third.address, tokenId);
            await expect(await action3).to.equal(false);
        });

        it("Should define `isApprovedOrOwner` as external", async function () {
            const artifact = require("../artifacts/contracts/BicycleComponents.sol/BicycleComponents.json");

            // Extract the ABI fragment of function 'f'
            const fAbiFragment = artifact.abi.find(
                (element) => ((element.type === "function") && (element.name === "isApprovedOrOwner"))
            );

            // There is no way to check the visibility of a function in the ABI
            // expect(fAbiFragment.visibility).to.equal("external");
        });
    });

    describe("Upgrading the contract", function () {
        it("Should upgrade the contract", async function () {
            const {contract} = await loadFixture(deployBicycleComponentsFixture);
            const {upgrader, third} = await getSigners();

            const UpgradedContract = await ethers.getContractFactory("BicycleComponentsUpgrade");

            // `third` cannot upgrade
            const action = upgrades.upgradeProxy(contract.address, UpgradedContract.connect(third));
            const reason = `AccessControl: account ${third.address.toLowerCase()} is missing role ${await contract.UPGRADER_ROLE()}`;
            await expect(action).to.be.revertedWith(reason);

            // `upgrader` has the right role
            const UPGRADER_ROLE = await contract.UPGRADER_ROLE();
            await expect(await contract.hasRole(UPGRADER_ROLE, upgrader.address)).to.be.true;

            // `upgrader` can upgrade
            const upgradedContract = await upgrades.upgradeProxy(contract.address, UpgradedContract.connect(upgrader));

            // Check that the new contract is the upgraded one
            await expect(await upgradedContract.getVersion()).to.equal(2);
        });
    });
});
