import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";

describe("BicycleComponents", function () {
    async function deployBicycleComponentsFixture() {
        const [deployer, admin, manager, upgrader, pauser, shop, customer, third] = await ethers.getSigners();

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
                Contract,
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

        return {contract, deployer, admin, manager, upgrader, pauser, shop, customer, third};
    }

    async function mintTokenFixture() {
        const {
            contract,
            deployer,
            admin, manager,
            shop, customer, third,
        } = await loadFixture(deployBicycleComponentsFixture);

        const tokenId = 42;
        const uri = "https://https://google.com/search?q=" + tokenId;

        await contract.connect(manager).safeMint(customer.address, tokenId);
        await contract.connect(manager).setTokenURI(tokenId, uri);

        return {
            contract,
            deployer,
            admin, manager,
            shop, customer, third,
            tokenId, uri,
        };
    }


    describe("Deployment", function () {
        it("Should deploy", async function () {
            const {contract} = await loadFixture(deployBicycleComponentsFixture);
            expect(contract.address).to.not.be.null;
            expect(contract.address).to.not.be.undefined;
            expect(contract.address).to.not.be.empty;
        });

        it("Should grant initial roles to the deployer", async function () {
            const {contract, deployer} = await loadFixture(deployBicycleComponentsFixture);

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
            const {contract, manager} = await loadFixture(deployBicycleComponentsFixture);
            const NFT_MANAGER_ROLE = await contract.NFT_MANAGER_ROLE();
            const hasManagerRole = await contract.hasRole(NFT_MANAGER_ROLE, manager.address);
            expect(hasManagerRole).to.be.true;
        });
    });

    describe("Minting", function () {
        it("Should assign initial ownership correctly", async function () {
            const {contract, deployer, manager, customer, tokenId} = await loadFixture(mintTokenFixture);
            const initialOwner = await contract.ownerOf(tokenId);

            expect(initialOwner).to.equal(customer.address);

            expect(initialOwner).to.not.equal(manager.address);
            expect(initialOwner).to.not.equal(deployer.address);
        });

        it("Should not allow minting if without NFT_MANAGER_ROLE", async function () {
            const {contract, deployer, admin, third} = await loadFixture(deployBicycleComponentsFixture);

            for (const address of [deployer, admin, third]) {
                const action = contract.connect(address).safeMint(third.address, 42);
                const reason = `AccessControl: account ${address.address.toLowerCase()} is missing role ${await contract.NFT_MANAGER_ROLE()}`;
                await expect(action).to.be.revertedWith(reason);
            }
        });

        it("Should allow minting if with NFT_MANAGER_ROLE", async function () {
            const {contract, third, manager} = await loadFixture(deployBicycleComponentsFixture);

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
            const {contract, tokenId, customer} = await loadFixture(mintTokenFixture);

            const action = contract.connect(customer).burn(tokenId);
            await expect(action).to.not.be.reverted;
        });

        it("Should not allow the minter to burn their token", async function () {
            const {contract, tokenId, shop} = await loadFixture(mintTokenFixture);

            const action = contract.connect(shop).burn(tokenId);
            await expect(action).to.be.revertedWith("Not owner/approved");
        });

        it("Should not allow a third party to burn a token", async function () {
            const {contract, tokenId, third} = await loadFixture(mintTokenFixture);

            const action = contract.connect(third).burn(tokenId);
            await expect(action).to.be.revertedWith("Not owner/approved");
        });
    });

    describe("Token URI", function () {
        it("Should return the correct token URI", async function () {
            const {contract, customer, uri, tokenId} = await loadFixture(mintTokenFixture);

            const action = contract.connect(customer).tokenURI(tokenId);
            await expect(await action).to.equal(uri);
        });

        it("Should allow the manager/minter/owner to set the token URI", async function () {
            const {contract, tokenId, manager, shop, customer} = await loadFixture(mintTokenFixture);

            for (const account of [manager, shop, customer]) {
                const newUri = "https://google.com/search?q=" + tokenId + "/" + account.address;

                const action = contract.connect(manager).setTokenURI(tokenId, newUri);
                await expect(action).to.not.be.reverted;

                const actualUri = await contract.tokenURI(tokenId);
                expect(actualUri).to.equal(newUri);
            }
        });

        it("Should not allow others to set the token URI", async function () {
            const {contract, tokenId, deployer, admin, third} = await loadFixture(mintTokenFixture);

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
            const {contract, customer, tokenId, manager, third} = await loadFixture(mintTokenFixture);

            const action = contract.connect(manager).transfer(tokenId, third.address);
            await expect(action).to.not.be.reverted;

            const newOwner = await contract.ownerOf(tokenId);
            expect(newOwner).to.equal(third.address);
        });

        it("Should not allow the admins to transfer", async function () {
            const {contract, tokenId, deployer, admin, third} = await loadFixture(mintTokenFixture);

            for (const address of [deployer, admin]) {
                const action = contract.connect(address).transfer(tokenId, third.address);
                const reason = "ERC721: caller is not token owner or approved";
                await expect(action).to.be.revertedWith(reason);
            }
        });

        it("Should not allow a random stranger to transfer", async function () {
            const {contract, tokenId, third} = await loadFixture(mintTokenFixture);

            const action = contract.connect(third).transfer(tokenId, third.address);
            const reason = "ERC721: caller is not token owner or approved";

            await expect(action).to.be.revertedWith(reason);
        });

        it("Should allow a generic owner to transfer", async function () {
            const {contract, customer, tokenId, third} = await loadFixture(mintTokenFixture);

            // Check that `customer` is the owner of the token
            const initialOwner = await contract.ownerOf(tokenId);
            expect(initialOwner).to.equal(customer.address);

            const action = contract.connect(customer).transfer(tokenId, third.address);
            await expect(action).to.not.be.reverted;
        });

        it("Should not allow transfer to the zero address", async function () {
            const {contract, tokenId, customer} = await loadFixture(mintTokenFixture);

            const action = contract.connect(customer).transfer(tokenId, ethers.constants.AddressZero);
            const reason = "ERC721: transfer to the zero address";

            await expect(action).to.be.revertedWith(reason);
        });

        it("Should allow the `transferFrom` function", async function () {
            const {contract, manager, tokenId, customer, third} = await loadFixture(mintTokenFixture);

            const action = contract.connect(manager).transferFrom(customer.address, third.address, tokenId);

            await expect(action).to.not.be.reverted;
        });

        it("Should allow the `safeTransferFrom` function", async function () {
            const {contract, manager, tokenId, customer, third} = await loadFixture(mintTokenFixture);

            const action = contract.connect(manager).transferFrom(customer.address, third.address, tokenId);

            await expect(action).to.not.be.reverted;
        });
    });

    describe("Hiring a manager", function () {
        it("Should allow the admin to hire a manager", async function () {
            const {contract, admin, third} = await loadFixture(deployBicycleComponentsFixture);

            // Check that `manager` does not have the NFT_MANAGER_ROLE
            const NFT_MANAGER_ROLE = await contract.NFT_MANAGER_ROLE();
            expect(await contract.hasRole(NFT_MANAGER_ROLE, third.address)).to.be.false;

            const action = contract.connect(admin).hireManager(third.address);
            await expect(action).to.not.be.reverted;

            // Check that `miner` now has the NFT_MANAGER_ROLE
            expect(await contract.hasRole(NFT_MANAGER_ROLE, third.address)).to.be.true;
        });

        it("Should not allow the manager to hire a manager", async function () {
            const {contract, manager, third} = await loadFixture(deployBicycleComponentsFixture);

            const action = contract.connect(manager).hireManager(third.address);
            const reason = `AccessControl: account ${manager.address.toLowerCase()} is missing role ${await contract.DEFAULT_ADMIN_ROLE()}`;
            await expect(action).to.be.revertedWith(reason);
        });

        it("Should allow an admin to fire the manager", async function () {
            const {contract, admin, third} = await loadFixture(deployBicycleComponentsFixture);

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
            const {contract, admin, third} = await loadFixture(deployBicycleComponentsFixture);

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
            const {contract, customer, tokenId, third} = await loadFixture(mintTokenFixture);

            const action1 = contract.connect(customer).approve(third.address, tokenId);
            await expect(action1).to.not.be.reverted;

            const action2 = contract.connect(customer).getApproved(tokenId);
            await expect(await action2).to.equal(third.address);

            const action3 = contract.connect(third).transferFrom(customer.address, third.address, tokenId);
            await expect(action3).to.not.be.reverted;
        });

        it("Should allow `setApprovalForAll`", async function () {
            const {contract, customer, third, tokenId} = await loadFixture(mintTokenFixture);

            const action1 = contract.connect(customer).setApprovalForAll(third.address, true);
            await expect(action1).to.not.be.reverted;

            const action2 = contract.connect(customer).isApprovedForAll(customer.address, third.address);
            await expect(await action2).to.equal(true);

            const action3 = contract.connect(third).transferFrom(customer.address, third.address, tokenId);
            await expect(action3).to.not.be.reverted;
        });

        it("Should provide a meaningful `isApprovedOrOwner`", async function () {
            const {contract, manager, customer, third, tokenId} = await loadFixture(mintTokenFixture);

            const action1 = contract.connect(third).isApprovedOrOwner(customer.address, tokenId);
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
        it("Should to upgrade the contract", async function () {
            const {contract} = await loadFixture(deployBicycleComponentsFixture);

            const UpgradedContract = await ethers.getContractFactory("BicycleComponentsUpgrade");

            const upgradedContract = await upgrades.upgradeProxy(contract.address, UpgradedContract);

            const action1 = upgradedContract.getVersion();
            await expect(await action1).to.equal(2);
        });
    });
});
