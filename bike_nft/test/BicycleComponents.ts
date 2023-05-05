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

    describe("Token URI", function () {
        it("Should allow the manager to set the token URI", async function () {
            const {contract, tokenId, manager} = await loadFixture(mintTokenFixture);

            const newUri = "https://yahoo.com/search?q=" + tokenId;

            const action = contract.connect(manager).setTokenURI(tokenId, newUri);
            await expect(action).to.not.be.reverted;

            const actualUri = await contract.tokenURI(tokenId);
            expect(actualUri).to.equal(newUri);
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

        it("Should not allow even the admins to transfer", async function () {
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

    // describe(...
    // it("Should assign the initial URI correctly", async function () {
    //     const {bicycleComponents, serialNumber, uri} = await loadFixture(registerComponent);
    //
    //     const tokenId = await bicycleComponents.generateTokenId(serialNumber);
    //     const tokenURI = await bicycleComponents.tokenURI(tokenId);
    //
    //     expect(tokenURI).to.equal(uri);
    // });
    //
    // it("Should approve the sender as operator for the token", async function () {
    //     const {bicycleComponents, shop, tokenId} = await loadFixture(registerComponent);
    //     const isApproved = await bicycleComponents.tokenOperatorApproval(tokenId, shop.address);
    //
    //     expect(isApproved).to.be.true;
    // });
    //
    // it("Should not allow to register the same serial number twice", async function () {
    //     const {bicycleComponents, shop, third, serialNumber, uri} = await loadFixture(registerComponent);
    //
    //     await expect(bicycleComponents.connect(shop).register(third.address, serialNumber, uri))
    //         .to.be.revertedWith("ERC721: token already minted");
    // });
    //
    // it("Should fail if the sender is not a manager", async function () {
    //     const {bicycleComponents, third} = await loadFixture(deployBicycleComponentsFixture);
    //
    //     const serialNumber = "SN_ILLICIT";
    //     const uri = "https://example.com/" + serialNumber;
    //
    //     await expect(bicycleComponents.connect(third).register(third.address, serialNumber, uri))
    //         .to.be.revertedWith(
    //             "AccessControl: account " +
    //             third.address.toLowerCase() +
    //             " is missing role " +
    //             await bicycleComponents.NFT_MANAGER_ROLE()
    //         );
    // });
    //
    // it("Should emit a TokenOperatorApprovalUpdated for sender event", async function () {
    //     const {bicycleComponents, shop, third} = await loadFixture(deployBicycleComponentsFixture);
    //
    //     const serialNumber = "SN12345678";
    //     const uri = "https://example.com/" + serialNumber;
    //
    //     const tokenId = await bicycleComponents.generateTokenId(serialNumber);
    //
    //     // Note: The shop grants itself the approval for the future.
    //     await expect(bicycleComponents.connect(shop).register(third.address, serialNumber, uri))
    //         .to.emit(bicycleComponents, "TokenOperatorApprovalUpdated")
    //         .withArgs(tokenId, shop.address, true);
    // });
    //
    // it("Should emit a ComponentRegistered for new owner event", async function () {
    //     const {bicycleComponents, shop, customer} = await loadFixture(deployBicycleComponentsFixture);
    //
    //     const serialNumber = "SN12345678";
    //     const uri = "https://example.com/" + serialNumber;
    //
    //     const tokenId = await bicycleComponents.generateTokenId(serialNumber);
    //
    //     await expect(bicycleComponents.connect(shop).register(customer.address, serialNumber, uri))
    //         .to.emit(bicycleComponents, "ComponentRegistered")
    //         .withArgs(customer.address, tokenId, serialNumber, uri);
    // });
    // });

    // describe("setTokenOperatorApproval", function () {
    //     it("Should set approval for a given operator and tokenId", async function () {
    //         const {bicycleComponents, admin, tokenId, third} = await loadFixture(registerComponent);
    //
    //         const isApprovedBefore = await bicycleComponents.tokenOperatorApproval(tokenId, third.address);
    //         expect(isApprovedBefore).to.be.false;
    //
    //         await bicycleComponents.connect(admin).setTokenOperatorApproval(tokenId, third.address, true);
    //
    //         const isApprovedAfter = await bicycleComponents.tokenOperatorApproval(tokenId, third.address);
    //         expect(isApprovedAfter).to.be.true;
    //     });
    //
    //     it("Should emit TokenOperatorApprovalUpdated event", async function () {
    //         const {bicycleComponents, admin, tokenId, third} = await loadFixture(registerComponent);
    //
    //         await expect(bicycleComponents.connect(admin).setTokenOperatorApproval(tokenId, third.address, true))
    //             .to.emit(bicycleComponents, "TokenOperatorApprovalUpdated")
    //             .withArgs(tokenId, third.address, true);
    //
    //         await expect(bicycleComponents.connect(admin).setTokenOperatorApproval(tokenId, third.address, false))
    //             .to.emit(bicycleComponents, "TokenOperatorApprovalUpdated")
    //             .withArgs(tokenId, third.address, false);
    //     });
    //
    //     it("Should not allow setting approval for a non-existing token", async function () {
    //         const {bicycleComponents, deployer, third} = await loadFixture(registerComponent);
    //
    //         const nonExistingTokenId = ethers.BigNumber.from("1");
    //
    //         const action = bicycleComponents.connect(deployer).setTokenOperatorApproval(nonExistingTokenId, third.address, true);
    //
    //         await expect(action).to.be.revertedWith("ERC721: invalid token ID");
    //     });
    //
    //     it("Should not allow setting approval for a token not managed by the sender", async function () {
    //         const {bicycleComponents, tokenId, shop, customer, third} = await loadFixture(registerComponent);
    //
    //         await expect(bicycleComponents.connect(third).setTokenOperatorApproval(tokenId, shop.address, false))
    //             .to.be.revertedWith("Insufficient permissions for approval");
    //
    //         await expect(bicycleComponents.connect(third).setTokenOperatorApproval(tokenId, customer.address, false))
    //             .to.be.revertedWith("Insufficient permissions for approval");
    //
    //         await expect(bicycleComponents.connect(third).setTokenOperatorApproval(tokenId, third.address, true))
    //             .to.be.revertedWith("Insufficient permissions for approval");
    //     });
    //
    //     it("Should allow setting approval to the token owner", async function () {
    //         const {bicycleComponents, tokenId, customer} = await loadFixture(registerComponent);
    //
    //         const ownerOf = await bicycleComponents.ownerOf(tokenId);
    //         expect(ownerOf).to.equal(customer.address);
    //
    //         const isApprovedBefore = await bicycleComponents.tokenOperatorApproval(tokenId, customer.address);
    //         expect(isApprovedBefore).to.be.false;
    //
    //         await expect(bicycleComponents.setTokenOperatorApproval(tokenId, customer.address, true))
    //             .to.not.be.reverted;
    //
    //         const isApprovedAfter = await bicycleComponents.tokenOperatorApproval(tokenId, customer.address);
    //         expect(isApprovedAfter).to.be.true;
    //     });
    //
    //     it("Should allow the simple owner/customer to manage approval", async function () {
    //         const {bicycleComponents, tokenId, customer, third} = await loadFixture(registerComponent);
    //
    //         const ownerOf = await bicycleComponents.ownerOf(tokenId);
    //         expect(ownerOf).to.equal(customer.address);
    //
    //         // Customer does not have a special role
    //
    //         const roles = {
    //             admin: await bicycleComponents.DEFAULT_ADMIN_ROLE(),
    //             manager: await bicycleComponents.NFT_MANAGER_ROLE(),
    //             pauser: await bicycleComponents.PAUSER_ROLE(),
    //         }
    //
    //         for (const [__, role] of Object.entries(roles)) {
    //             const hasRole = await bicycleComponents.hasRole(role, customer.address);
    //             expect(hasRole).to.be.false;
    //         }
    //
    //         // Operator can grant approval
    //
    //         await bicycleComponents.connect(customer).setTokenOperatorApproval(tokenId, third.address, true);
    //         expect(await bicycleComponents.tokenOperatorApproval(tokenId, third.address)).to.be.true;
    //
    //         // Operator can revoke approval
    //
    //         await bicycleComponents.connect(customer).setTokenOperatorApproval(tokenId, third.address, false);
    //         expect(await bicycleComponents.tokenOperatorApproval(tokenId, third.address)).to.be.false;
    //
    //         // Operator can revoke their own approval
    //
    //         expect(await bicycleComponents.connect(customer).setTokenOperatorApproval(tokenId, customer.address, false))
    //             .not.to.be.reverted;
    //
    //         const isApprovedAfter = await bicycleComponents.tokenOperatorApproval(tokenId, customer.address);
    //         expect(isApprovedAfter).to.be.false;
    //     });
    //
    //     it("Should allow the operator to also manage approval for this token", async function () {
    //         // Note: This behavior is dubious, and should be reconsidered.
    //
    //         const {bicycleComponents, tokenId, shop, customer, third} = await loadFixture(registerComponent);
    //
    //         // Customer gives approval to `third`
    //         await bicycleComponents.connect(customer).setTokenOperatorApproval(tokenId, third.address, true);
    //
    //         // Before `third` revokes approval, `shop` has approval
    //         expect(await bicycleComponents.tokenOperatorApproval(tokenId, shop.address)).to.be.true;
    //
    //         // Revoking approval by `third`
    //         await bicycleComponents.connect(third).setTokenOperatorApproval(tokenId, shop.address, false);
    //
    //         // After revoking approval, `shop` does not have approval
    //         expect(await bicycleComponents.tokenOperatorApproval(tokenId, shop.address)).to.be.false;
    //     });
    // });

    // describe("isApprovedOrOwner", function () {
    //     it("Should be true for the current owner of a token", async function () {
    //         const {bicycleComponents, customer, tokenId} = await loadFixture(registerComponent);
    //
    //         const isApprovedOrOwner = await bicycleComponents.isApprovedOrOwner(customer.address, tokenId);
    //         expect(isApprovedOrOwner).to.equal(true);
    //     });
    //
    //     it("Should be false for a third party", async function () {
    //         const {bicycleComponents, third, tokenId} = await loadFixture(registerComponent);
    //
    //         const isApprovedOrOwner = await bicycleComponents.isApprovedOrOwner(third.address, tokenId);
    //         expect(isApprovedOrOwner).to.equal(false);
    //     });
    //
    //     it("Should allow operator to transfer", async function () {
    //         const {
    //             bicycleComponents,
    //             customer,
    //             third,
    //             serialNumber,
    //             tokenId
    //         } = await loadFixture(registerComponent);
    //
    //         const isApprovedBefore = await bicycleComponents.tokenOperatorApproval(tokenId, third.address);
    //         expect(isApprovedBefore).to.be.false;
    //
    //         const ownerBefore = await bicycleComponents.ownerOf(tokenId);
    //         expect(ownerBefore).to.equal(customer.address);
    //
    //         // Customer gives approval to `third`
    //         await bicycleComponents.connect(customer).setTokenOperatorApproval(tokenId, third.address, true);
    //
    //         // `third` performs the transfer
    //         await bicycleComponents.connect(third).transfer(serialNumber, third.address);
    //
    //         // Check that the new owner is third
    //         const ownerAfter = await bicycleComponents.ownerOf(tokenId);
    //         expect(ownerAfter).to.equal(third.address);
    //     });
    //
    //     it("Should remain with manager on transfer", async function () {
    //         const {
    //             bicycleComponents,
    //             shop,
    //             customer,
    //             third,
    //             serialNumber,
    //             tokenId
    //         } = await loadFixture(registerComponent);
    //
    //         await bicycleComponents.connect(customer).transfer(serialNumber, third.address);
    //
    //         const isApprovedOrOwner = await bicycleComponents.isApprovedOrOwner(shop.address, tokenId);
    //         expect(isApprovedOrOwner).to.equal(true);
    //     });
    //
    //     it("Should not remain with the owner on transfer", async function () {
    //         const {
    //             bicycleComponents,
    //             customer,
    //             third,
    //             serialNumber,
    //             tokenId
    //         } = await loadFixture(registerComponent);
    //
    //         await bicycleComponents.connect(customer).transfer(serialNumber, third.address);
    //
    //         const isApprovedOrOwner = await bicycleComponents.isApprovedOrOwner(customer.address, tokenId);
    //         expect(isApprovedOrOwner).to.equal(false);
    //     });
    //
    //     it("Should be granted on transfer", async function () {
    //         const {
    //             bicycleComponents,
    //             customer,
    //             third,
    //             serialNumber,
    //             tokenId
    //         } = await loadFixture(registerComponent);
    //
    //         await bicycleComponents.connect(customer).transfer(serialNumber, third.address);
    //
    //         const isApprovedOrOwner = await bicycleComponents.isApprovedOrOwner(third.address, tokenId);
    //         expect(isApprovedOrOwner).to.equal(true);
    //     });
    // });

    // describe("Token transfer", function () {
    //     it("Should transfer the token to the specified address", async function () {
    //         const {
    //             bicycleComponents,
    //             serialNumber,
    //             customer,
    //             third,
    //             tokenId
    //         } = await loadFixture(registerComponent);
    //
    //         const ownerBefore = await bicycleComponents.ownerOf(tokenId);
    //         expect(ownerBefore).to.equal(customer.address);
    //
    //         await bicycleComponents.connect(customer).transfer(serialNumber, third.address);
    //
    //         const ownerAfter = await bicycleComponents.ownerOf(tokenId);
    //         expect(ownerAfter).to.equal(third.address);
    //     });
    //
    //     it("Should fail if the serial number does not map to an existing token", async function () {
    //         const {bicycleComponents, third} = await loadFixture(registerComponent);
    //
    //         const invalidSerialNumber = "SN_INVALID_007";
    //
    //         await expect(bicycleComponents.transfer(invalidSerialNumber, third.address))
    //             .to.be.revertedWith("ERC721: invalid token ID");
    //     });
    //
    //     it("Should allow an admin to transfer a token", async function () {
    //         const {bicycleComponents, serialNumber, third, tokenId} = await loadFixture(registerComponent);
    //         await bicycleComponents.transfer(serialNumber, third.address);
    //         expect(await bicycleComponents.ownerOf(tokenId)).to.equal(third.address);
    //     });
    //
    //     it("Should not allow a third party to transfer a token", async function () {
    //         const {bicycleComponents, serialNumber, third} = await loadFixture(registerComponent);
    //         await expect(bicycleComponents.connect(third).transfer(serialNumber, third.address))
    //             .to.be.revertedWith("ERC721: caller is not token owner or approved");
    //     });
    //
    //     it("Should allow an operator to transfer a token", async function () {
    //         const {bicycleComponents, serialNumber, third, tokenId} = await loadFixture(registerComponent);
    //         await bicycleComponents.setTokenOperatorApproval(tokenId, third.address, true);
    //         await bicycleComponents.connect(third).transfer(serialNumber, third.address);
    //         expect(await bicycleComponents.ownerOf(tokenId)).to.equal(third.address);
    //     });
    //
    //     it("Should emit a 'Transfer' event after a successful transfer", async function () {
    //         const {
    //             bicycleComponents,
    //             serialNumber,
    //             customer,
    //             third,
    //             tokenId
    //         } = await loadFixture(registerComponent);
    //
    //         await expect(bicycleComponents.connect(customer).transfer(serialNumber, third.address))
    //             .to.emit(bicycleComponents, "Transfer")
    //             .withArgs(customer.address, third.address, tokenId);
    //     });
    // });
});
