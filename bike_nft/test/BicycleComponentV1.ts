import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";

describe("BicycleComponentV1", function () {
    async function deployBicycleComponentFixture() {
        const [deployer, admin, shop, customer, third] = await ethers.getSigners();

        const BicycleComponentV1 = await ethers.getContractFactory("BicycleComponentV1");

        /**
         * When you deploy a "transparent" contract using the `upgrades.deployProxy` function from the OpenZeppelin Upgrades plugin, it deploys a proxy contract and the implementation contract, as well as a ProxyAdmin contract if you haven't deployed one already. Here's an explanation of each contract:
         *
         * 1. **Proxy contract**: The proxy contract is the entry point for all interactions with your contract. It forwards function calls to the implementation contract while maintaining the contract's state. The proxy contract allows you to upgrade the implementation contract without changing the contract's address.
         *
         * 2. **Implementation contract**: This contract contains the actual business logic of your contract. When you upgrade the contract, you deploy a new implementation contract, and the proxy contract starts forwarding calls to the new implementation.
         *
         * 3. **ProxyAdmin contract**: The ProxyAdmin contract is used to manage and control the proxy contract and the implementation contract. It is responsible for upgrading the implementation contract and changing the admin of the proxy contract. Typically, there is only one ProxyAdmin contract per project, which manages all the proxy contracts in the project.
         *
         * In your deployment code, you are using the `transparent` proxy kind, which means that the proxy contract will be transparent to both users and the contract itself. This allows users to interact with the contract as if they were interacting with the implementation contract directly. The `initializer` option specifies the function to be called during the deployment to initialize the contract, and the `value` option sets the amount of Ether sent during the deployment (0 in this case, meaning no Ether is sent).
         */

        /**
         * When you deploy a UUPS proxy using `upgrades.deployProxy`, it deploys two contracts:
         *
         * 1. The implementation contract: This is an instance of the contract you provided (in this case, `BicycleComponentV1`). It contains the actual logic and storage layout of your contract.
         * 2. The proxy contract: This is a separate contract that forwards all calls to the implementation contract while preserving its own storage, enabling upgradeability.
         *
         * In a UUPS (Universal Upgradeable Proxy Standard) deployment, there is no separate admin contract (unlike in a Transparent Proxy deployment). The upgrade authorization mechanism is directly built into the proxy contract, and the upgrade process is managed by the proxy using the functions provided by the `UUPSUpgradeable` contract.
         *
         * In summary, the deployment you provided creates two contracts: the `BicycleComponentV1` implementation contract and the UUPS proxy contract that manages access to the implementation.
         */

            // https://dev.to/abhikbanerjee99/testing-your-upgradeable-smart-contract-2fjd
        const bicycleComponentV1 = await upgrades.deployProxy(
                BicycleComponentV1,
                [],
                {
                    initializer: 'initialize',
                    kind: 'uups',
                    value: 0,
                }
            );

        const proxyAddress = bicycleComponentV1.address;
        console.log("Proxy Address:", proxyAddress);

        const implementationAddress = await upgrades.erc1967.getImplementationAddress(proxyAddress);
        console.log("Impln Address:", implementationAddress);

        const adminAddress = await upgrades.erc1967.getAdminAddress(proxyAddress);
        console.log("Admin Address:", adminAddress);

        const DEFAULT_ADMIN_ROLE = await bicycleComponentV1.DEFAULT_ADMIN_ROLE();
        await bicycleComponentV1.grantRole(DEFAULT_ADMIN_ROLE, admin.address);

        const UPGRADER_ROLE = await bicycleComponentV1.UPGRADER_ROLE();
        await bicycleComponentV1.grantRole(UPGRADER_ROLE, admin.address);

        const MINTER_ROLE = await bicycleComponentV1.MINTER_ROLE();
        await bicycleComponentV1.grantRole(MINTER_ROLE, shop.address);

        return {bicycleComponentV1, deployer, admin, shop, customer, third};
    }


    async function registerComponent() {
        const {
            bicycleComponentV1,
            deployer,
            admin, shop, customer, third,
        } = await loadFixture(deployBicycleComponentFixture);

        const serialNumber = "SN12345678";
        const uri = "https://example.com/" + serialNumber;

        const tokenId = await bicycleComponentV1.generateTokenId(serialNumber);

        await bicycleComponentV1.connect(shop).register(customer.address, serialNumber, uri);

        return {
            bicycleComponentV1,
            deployer,
            admin, shop, customer, third,
            serialNumber, uri, tokenId,
        };
    }


    describe("Deployment", function () {
        it("Should deploy", async function () {
            const {bicycleComponentV1} = await loadFixture(deployBicycleComponentFixture);
            expect(bicycleComponentV1.address).to.not.be.null;
            expect(bicycleComponentV1.address).to.not.be.undefined;
            expect(bicycleComponentV1.address).to.not.be.empty;
        });

        it("Should grant initial roles to the deployer", async function () {
            const {bicycleComponentV1, deployer} = await loadFixture(deployBicycleComponentFixture);

            const DEFAULT_ADMIN_ROLE = await bicycleComponentV1.DEFAULT_ADMIN_ROLE();
            const PAUSER_ROLE = await bicycleComponentV1.PAUSER_ROLE();
            const MINTER_ROLE = await bicycleComponentV1.MINTER_ROLE();

            const hasAdminRole = await bicycleComponentV1.hasRole(DEFAULT_ADMIN_ROLE, deployer.address);
            const hasPauserRole = await bicycleComponentV1.hasRole(PAUSER_ROLE, deployer.address);
            const hasMinterRole = await bicycleComponentV1.hasRole(MINTER_ROLE, deployer.address);

            expect(hasAdminRole).to.be.true;
            expect(hasPauserRole).to.be.true;
            expect(hasMinterRole).to.be.true;
        });

        it("Should generate a consistent tokenId from serialNumber", async function () {
            const {bicycleComponentV1} = await loadFixture(deployBicycleComponentFixture);

            const serialNumber = "SN12345678";
            const tokenId = await bicycleComponentV1.generateTokenId(serialNumber);

            expect(tokenId).to.equal(ethers.BigNumber.from("71287863191742338490528408279695658820772154164895693571530902880079996237432"));
        });

        describe("Payment", function () {
            it("Should deploy with zero minAmountOnRegister", async function () {
                const {bicycleComponentV1} = await loadFixture(deployBicycleComponentFixture);

                const minAmountOnRegister = await bicycleComponentV1.minAmountOnRegister();
                expect(minAmountOnRegister).to.equal(0);
            });

            it("Should allow an admin to set minAmountOnRegister", async function () {
                const {bicycleComponentV1, admin} = await loadFixture(deployBicycleComponentFixture);

                const newMinAmountOnRegister = ethers.utils.parseUnits("0.001", "ether");
                await bicycleComponentV1.connect(admin).setMinAmountOnRegister(newMinAmountOnRegister);

                const minAmountOnRegister = await bicycleComponentV1.minAmountOnRegister();
                expect(minAmountOnRegister).to.equal(newMinAmountOnRegister);
            });

            it("Should not allow a non-admin to set minAmountOnRegister", async function () {
                const {bicycleComponentV1, shop} = await loadFixture(deployBicycleComponentFixture);

                const newMinAmountOnRegister = ethers.utils.parseUnits("0.001", "ether");
                const action = bicycleComponentV1.connect(shop).setMinAmountOnRegister(newMinAmountOnRegister);

                await expect(action).to.be.revertedWith(
                    "AccessControl: account " +
                    shop.address.toLowerCase() +
                    " is missing role " +
                    await bicycleComponentV1.DEFAULT_ADMIN_ROLE()
                );
            });

            it("Should revert if minAmountOnRegister is not met when registering", async function () {
                const {bicycleComponentV1, admin, shop, customer} = await loadFixture(deployBicycleComponentFixture);

                const minAmountOnRegister = ethers.utils.parseUnits("10", "ether");
                await bicycleComponentV1.connect(admin).setMinAmountOnRegister(minAmountOnRegister);

                const serialNumber = "SN12345678";
                const uri = "https://example.com/" + serialNumber;
                const value = ethers.utils.parseUnits("1", "ether");

                const action = bicycleComponentV1.connect(shop).register(customer.address, serialNumber, uri, {value: value});

                await expect(action).to.be.revertedWith("Payment is less than the minimum `_minAmountOnRegister`");
            });

            it("Should keep only the minimal payment with the contract", async function () {
                const {bicycleComponentV1, admin, shop, customer} = await loadFixture(deployBicycleComponentFixture);

                const minAmountOnRegister = ethers.utils.parseUnits("1", "ether");
                await bicycleComponentV1.connect(admin).setMinAmountOnRegister(minAmountOnRegister);

                const serialNumber = "SN12345678";
                const uri = "https://example.com/" + serialNumber;
                const valueToSend = ethers.utils.parseUnits("2", "ether");

                expect(valueToSend).to.be.gt(minAmountOnRegister);

                // Register with an amount that is more than the minimum
                await bicycleComponentV1.connect(shop).register(customer.address, serialNumber, uri, {value: valueToSend});

                // Check that the contract balance is equal to the minimum
                const balance = await ethers.provider.getBalance(bicycleComponentV1.address);
                expect(balance).to.equal(minAmountOnRegister);
            });

            it("Should allow an admin to withdraw the contract balance to the admin", async function () {
                const {bicycleComponentV1, admin, shop, customer} = await loadFixture(deployBicycleComponentFixture);

                const adminBalanceBefore = await ethers.provider.getBalance(admin.address);

                const minAmountOnRegister = ethers.utils.parseUnits("1", "ether");
                await bicycleComponentV1.connect(admin).setMinAmountOnRegister(minAmountOnRegister);

                const serialNumber = "SN12345678";
                const uri = "https://example.com/" + serialNumber;

                await bicycleComponentV1.connect(shop).register(customer.address, serialNumber, uri, {value: minAmountOnRegister});

                // Withdraw the contract balance to the admin to avoid counting gas
                await bicycleComponentV1.connect(admin).withdraw();

                // Check that the admin balance is now larger
                // We don't check the exact value because of gas costs
                const adminBalanceAfter = await ethers.provider.getBalance(admin.address);
                expect(adminBalanceAfter).to.be.gt(adminBalanceBefore);
            });

            it("Should allow an admin to withdraw the contract balance to any address", async function () {
                const {bicycleComponentV1, admin, shop, customer, third} = await loadFixture(deployBicycleComponentFixture);

                const thirdBalanceBefore = await ethers.provider.getBalance(third.address);

                const minAmountOnRegister = ethers.utils.parseUnits("1", "ether");
                await bicycleComponentV1.connect(admin).setMinAmountOnRegister(minAmountOnRegister);

                const serialNumber = "SN12345678";
                const uri = "https://example.com/" + serialNumber;

                await bicycleComponentV1.connect(shop).register(customer.address, serialNumber, uri, {value: minAmountOnRegister});

                // Withdraw the contract balance to a `third` to avoid counting gas
                await bicycleComponentV1.connect(admin).withdrawTo(third.address);

                // Check that the contract balance is now zero
                const newBalance = await ethers.provider.getBalance(bicycleComponentV1.address);
                expect(newBalance).to.equal(0);

                // Check that `third` has received the full contract balance
                const thirdBalance = await ethers.provider.getBalance(third.address);
                expect(thirdBalance).to.equal(thirdBalanceBefore.add(minAmountOnRegister));
            });

            it("Should not allow a non-admin to withdraw the contract balance", async function () {
                const {bicycleComponentV1, shop, customer} = await loadFixture(deployBicycleComponentFixture);

                const serialNumber = "SN12345678";
                const uri = "https://example.com/" + serialNumber;

                await bicycleComponentV1.connect(shop).register(customer.address, serialNumber, uri, {value: 1});

                const action = bicycleComponentV1.connect(shop).withdraw();

                await expect(action).to.be.revertedWith(
                    "AccessControl: account " +
                    shop.address.toLowerCase() +
                    " is missing role " +
                    await bicycleComponentV1.DEFAULT_ADMIN_ROLE()
                );
            });

            it("Should revert if there is nothing to withdraw", async function () {
                const {bicycleComponentV1, admin} = await loadFixture(deployBicycleComponentFixture);

                const action = bicycleComponentV1.connect(admin).withdraw();

                await expect(action).to.be.revertedWith("There is nothing to withdraw");
            });
        });

        describe("Registration", function () {
            it("Should assign initial ownership correctly", async function () {
                const {bicycleComponentV1, customer, tokenId} = await loadFixture(registerComponent);
                const initialOwner = await bicycleComponentV1.ownerOf(tokenId);

                expect(initialOwner).to.equal(customer.address);
            });

            it("Should assign the initial URI correctly", async function () {
                const {bicycleComponentV1, serialNumber, uri} = await loadFixture(registerComponent);

                const tokenId = await bicycleComponentV1.generateTokenId(serialNumber);
                const tokenURI = await bicycleComponentV1.tokenURI(tokenId);

                expect(tokenURI).to.equal(uri);
            });

            it("Should approve the sender as operator for the token", async function () {
                const {bicycleComponentV1, shop, tokenId} = await loadFixture(registerComponent);
                const isApproved = await bicycleComponentV1.tokenOperatorApproval(tokenId, shop.address);

                expect(isApproved).to.be.true;
            });

            it("Should not allow to register the same serial number twice", async function () {
                const {bicycleComponentV1, shop, third, serialNumber, uri} = await loadFixture(registerComponent);

                await expect(bicycleComponentV1.connect(shop).register(third.address, serialNumber, uri))
                    .to.be.revertedWith("ERC721: token already minted");
            });

            it("Should fail if the sender is not a minter", async function () {
                const {bicycleComponentV1, third} = await loadFixture(deployBicycleComponentFixture);

                const serialNumber = "SN_ILLICIT";
                const uri = "https://example.com/" + serialNumber;

                await expect(bicycleComponentV1.connect(third).register(third.address, serialNumber, uri))
                    .to.be.revertedWith(
                        "AccessControl: account " +
                        third.address.toLowerCase() +
                        " is missing role " +
                        await bicycleComponentV1.MINTER_ROLE()
                    );
            });

            it("Should emit a TokenOperatorApprovalUpdated for sender event", async function () {
                const {bicycleComponentV1, shop, third} = await loadFixture(deployBicycleComponentFixture);

                const serialNumber = "SN12345678";
                const uri = "https://example.com/" + serialNumber;

                const tokenId = await bicycleComponentV1.generateTokenId(serialNumber);

                // Note: The shop grants itself the approval for the future.
                await expect(bicycleComponentV1.connect(shop).register(third.address, serialNumber, uri))
                    .to.emit(bicycleComponentV1, "TokenOperatorApprovalUpdated")
                    .withArgs(tokenId, shop.address, true);
            });

            it("Should emit a ComponentRegistered for new owner event", async function () {
                const {bicycleComponentV1, shop, customer} = await loadFixture(deployBicycleComponentFixture);

                const serialNumber = "SN12345678";
                const uri = "https://example.com/" + serialNumber;

                const tokenId = await bicycleComponentV1.generateTokenId(serialNumber);

                await expect(bicycleComponentV1.connect(shop).register(customer.address, serialNumber, uri))
                    .to.emit(bicycleComponentV1, "ComponentRegistered")
                    .withArgs(customer.address, tokenId, serialNumber, uri);
            });
        });

        describe("setTokenOperatorApproval", function () {
            it("Should set approval for a given operator and tokenId", async function () {
                const {bicycleComponentV1, admin, tokenId, third} = await loadFixture(registerComponent);

                const isApprovedBefore = await bicycleComponentV1.tokenOperatorApproval(tokenId, third.address);
                expect(isApprovedBefore).to.be.false;

                await bicycleComponentV1.connect(admin).setTokenOperatorApproval(tokenId, third.address, true);

                const isApprovedAfter = await bicycleComponentV1.tokenOperatorApproval(tokenId, third.address);
                expect(isApprovedAfter).to.be.true;
            });

            it("Should emit TokenOperatorApprovalUpdated event", async function () {
                const {bicycleComponentV1, admin, tokenId, third} = await loadFixture(registerComponent);

                await expect(bicycleComponentV1.connect(admin).setTokenOperatorApproval(tokenId, third.address, true))
                    .to.emit(bicycleComponentV1, "TokenOperatorApprovalUpdated")
                    .withArgs(tokenId, third.address, true);

                await expect(bicycleComponentV1.connect(admin).setTokenOperatorApproval(tokenId, third.address, false))
                    .to.emit(bicycleComponentV1, "TokenOperatorApprovalUpdated")
                    .withArgs(tokenId, third.address, false);
            });

            it("Should not allow setting approval for a non-existing token", async function () {
                const {bicycleComponentV1, deployer, third} = await loadFixture(registerComponent);

                const nonExistingTokenId = ethers.BigNumber.from("1");

                const action = bicycleComponentV1.connect(deployer).setTokenOperatorApproval(nonExistingTokenId, third.address, true);

                await expect(action).to.be.revertedWith("ERC721: invalid token ID");
            });

            it("Should not allow setting approval for a token not managed by the sender", async function () {
                const {bicycleComponentV1, tokenId, shop, customer, third} = await loadFixture(registerComponent);

                await expect(bicycleComponentV1.connect(third).setTokenOperatorApproval(tokenId, shop.address, false))
                    .to.be.revertedWith("Insufficient permissions for approval");

                await expect(bicycleComponentV1.connect(third).setTokenOperatorApproval(tokenId, customer.address, false))
                    .to.be.revertedWith("Insufficient permissions for approval");

                await expect(bicycleComponentV1.connect(third).setTokenOperatorApproval(tokenId, third.address, true))
                    .to.be.revertedWith("Insufficient permissions for approval");
            });

            it("Should allow setting approval to the token owner", async function () {
                const {bicycleComponentV1, tokenId, customer} = await loadFixture(registerComponent);

                const ownerOf = await bicycleComponentV1.ownerOf(tokenId);
                expect(ownerOf).to.equal(customer.address);

                const isApprovedBefore = await bicycleComponentV1.tokenOperatorApproval(tokenId, customer.address);
                expect(isApprovedBefore).to.be.false;

                await expect(bicycleComponentV1.setTokenOperatorApproval(tokenId, customer.address, true))
                    .to.not.be.reverted;

                const isApprovedAfter = await bicycleComponentV1.tokenOperatorApproval(tokenId, customer.address);
                expect(isApprovedAfter).to.be.true;
            });

            it("Should allow the simple owner/customer to manage approval", async function () {
                const {bicycleComponentV1, tokenId, customer, third} = await loadFixture(registerComponent);

                const ownerOf = await bicycleComponentV1.ownerOf(tokenId);
                expect(ownerOf).to.equal(customer.address);

                // Customer does not have a special role

                const roles = {
                    admin: await bicycleComponentV1.DEFAULT_ADMIN_ROLE(),
                    minter: await bicycleComponentV1.MINTER_ROLE(),
                    pauser: await bicycleComponentV1.PAUSER_ROLE(),
                }

                for (const [__, role] of Object.entries(roles)) {
                    const hasRole = await bicycleComponentV1.hasRole(role, customer.address);
                    expect(hasRole).to.be.false;
                }

                // Operator can grant approval

                await bicycleComponentV1.connect(customer).setTokenOperatorApproval(tokenId, third.address, true);
                expect(await bicycleComponentV1.tokenOperatorApproval(tokenId, third.address)).to.be.true;

                // Operator can revoke approval

                await bicycleComponentV1.connect(customer).setTokenOperatorApproval(tokenId, third.address, false);
                expect(await bicycleComponentV1.tokenOperatorApproval(tokenId, third.address)).to.be.false;

                // Operator can revoke their own approval

                expect(await bicycleComponentV1.connect(customer).setTokenOperatorApproval(tokenId, customer.address, false))
                    .not.to.be.reverted;

                const isApprovedAfter = await bicycleComponentV1.tokenOperatorApproval(tokenId, customer.address);
                expect(isApprovedAfter).to.be.false;
            });

            it("Should allow the operator to also manage approval for this token", async function () {
                // Note: This behavior is dubious, and should be reconsidered.

                const {bicycleComponentV1, tokenId, shop, customer, third} = await loadFixture(registerComponent);

                // Customer gives approval to `third`
                await bicycleComponentV1.connect(customer).setTokenOperatorApproval(tokenId, third.address, true);

                // Before `third` revokes approval, `shop` has approval
                expect(await bicycleComponentV1.tokenOperatorApproval(tokenId, shop.address)).to.be.true;

                // Revoking approval by `third`
                await bicycleComponentV1.connect(third).setTokenOperatorApproval(tokenId, shop.address, false);

                // After revoking approval, `shop` does not have approval
                expect(await bicycleComponentV1.tokenOperatorApproval(tokenId, shop.address)).to.be.false;
            });
        });

        describe("isApprovedOrOwner", function () {
            it("Should be true for the current owner of a token", async function () {
                const {bicycleComponentV1, customer, tokenId} = await loadFixture(registerComponent);

                const isApprovedOrOwner = await bicycleComponentV1.isApprovedOrOwner(customer.address, tokenId);
                expect(isApprovedOrOwner).to.equal(true);
            });

            it("Should be false for a third party", async function () {
                const {bicycleComponentV1, third, tokenId} = await loadFixture(registerComponent);

                const isApprovedOrOwner = await bicycleComponentV1.isApprovedOrOwner(third.address, tokenId);
                expect(isApprovedOrOwner).to.equal(false);
            });

            it("Should allow operator to transfer", async function () {
                const {
                    bicycleComponentV1,
                    customer,
                    third,
                    serialNumber,
                    tokenId
                } = await loadFixture(registerComponent);

                const isApprovedBefore = await bicycleComponentV1.tokenOperatorApproval(tokenId, third.address);
                expect(isApprovedBefore).to.be.false;

                const ownerBefore = await bicycleComponentV1.ownerOf(tokenId);
                expect(ownerBefore).to.equal(customer.address);

                // Customer gives approval to `third`
                await bicycleComponentV1.connect(customer).setTokenOperatorApproval(tokenId, third.address, true);

                // `third` performs the transfer
                await bicycleComponentV1.connect(third).transfer(serialNumber, third.address);

                // Check that the new owner is third
                const ownerAfter = await bicycleComponentV1.ownerOf(tokenId);
                expect(ownerAfter).to.equal(third.address);
            });

            it("Should remain with minter on transfer", async function () {
                const {
                    bicycleComponentV1,
                    shop,
                    customer,
                    third,
                    serialNumber,
                    tokenId
                } = await loadFixture(registerComponent);

                await bicycleComponentV1.connect(customer).transfer(serialNumber, third.address);

                const isApprovedOrOwner = await bicycleComponentV1.isApprovedOrOwner(shop.address, tokenId);
                expect(isApprovedOrOwner).to.equal(true);
            });

            it("Should not remain with the owner on transfer", async function () {
                const {
                    bicycleComponentV1,
                    customer,
                    third,
                    serialNumber,
                    tokenId
                } = await loadFixture(registerComponent);

                await bicycleComponentV1.connect(customer).transfer(serialNumber, third.address);

                const isApprovedOrOwner = await bicycleComponentV1.isApprovedOrOwner(customer.address, tokenId);
                expect(isApprovedOrOwner).to.equal(false);
            });

            it("Should be granted on transfer", async function () {
                const {
                    bicycleComponentV1,
                    customer,
                    third,
                    serialNumber,
                    tokenId
                } = await loadFixture(registerComponent);

                await bicycleComponentV1.connect(customer).transfer(serialNumber, third.address);

                const isApprovedOrOwner = await bicycleComponentV1.isApprovedOrOwner(third.address, tokenId);
                expect(isApprovedOrOwner).to.equal(true);
            });
        });

        describe("Token transfer", function () {
            it("Should transfer the token to the specified address", async function () {
                const {
                    bicycleComponentV1,
                    serialNumber,
                    customer,
                    third,
                    tokenId
                } = await loadFixture(registerComponent);

                const ownerBefore = await bicycleComponentV1.ownerOf(tokenId);
                expect(ownerBefore).to.equal(customer.address);

                await bicycleComponentV1.connect(customer).transfer(serialNumber, third.address);

                const ownerAfter = await bicycleComponentV1.ownerOf(tokenId);
                expect(ownerAfter).to.equal(third.address);
            });

            it("Should fail if the serial number does not map to an existing token", async function () {
                const {bicycleComponentV1, third} = await loadFixture(registerComponent);

                const invalidSerialNumber = "SN_INVALID_007";

                await expect(bicycleComponentV1.transfer(invalidSerialNumber, third.address))
                    .to.be.revertedWith("ERC721: invalid token ID");
            });

            it("Should allow an admin to transfer a token", async function () {
                const {bicycleComponentV1, serialNumber, third, tokenId} = await loadFixture(registerComponent);
                await bicycleComponentV1.transfer(serialNumber, third.address);
                expect(await bicycleComponentV1.ownerOf(tokenId)).to.equal(third.address);
            });

            it("Should not allow a third party to transfer a token", async function () {
                const {bicycleComponentV1, serialNumber, third} = await loadFixture(registerComponent);
                await expect(bicycleComponentV1.connect(third).transfer(serialNumber, third.address))
                    .to.be.revertedWith("ERC721: caller is not token owner or approved");
            });

            it("Should allow an operator to transfer a token", async function () {
                const {bicycleComponentV1, serialNumber, third, tokenId} = await loadFixture(registerComponent);
                await bicycleComponentV1.setTokenOperatorApproval(tokenId, third.address, true);
                await bicycleComponentV1.connect(third).transfer(serialNumber, third.address);
                expect(await bicycleComponentV1.ownerOf(tokenId)).to.equal(third.address);
            });

            it("Should emit a 'Transfer' event after a successful transfer", async function () {
                const {
                    bicycleComponentV1,
                    serialNumber,
                    customer,
                    third,
                    tokenId
                } = await loadFixture(registerComponent);

                await expect(bicycleComponentV1.connect(customer).transfer(serialNumber, third.address))
                    .to.emit(bicycleComponentV1, "Transfer")
                    .withArgs(customer.address, third.address, tokenId);
            });
        });

        describe("Missing status", async function () {
            it("Should be `false` initially", async function () {
                const {bicycleComponentV1, serialNumber} = await loadFixture(registerComponent);
                expect(await bicycleComponentV1.missingStatus(serialNumber)).to.be.false;
            });

            it("Should allow the owner to set the missing status of a component", async function () {
                const {bicycleComponentV1, serialNumber, customer} = await loadFixture(registerComponent);
                expect(await bicycleComponentV1.missingStatus(serialNumber)).to.be.false;

                await bicycleComponentV1.connect(customer).setMissingStatus(serialNumber, true);
                expect(await bicycleComponentV1.missingStatus(serialNumber)).to.be.true;
            });

            it("Should allow an admin to set the missing status of a component", async function () {
                const {bicycleComponentV1, serialNumber} = await loadFixture(registerComponent);
                expect(await bicycleComponentV1.missingStatus(serialNumber)).to.be.false;

                await bicycleComponentV1.setMissingStatus(serialNumber, true);
                expect(await bicycleComponentV1.missingStatus(serialNumber)).to.be.true;
            });

            it("Should not allow the previous owner to set the missing status", async function () {
                const {bicycleComponentV1, serialNumber, customer, third} = await loadFixture(registerComponent);
                expect(await bicycleComponentV1.missingStatus(serialNumber)).to.be.false;

                // Transfer to `third`
                await bicycleComponentV1.connect(customer).transfer(serialNumber, third.address);

                // Previous owner tries to set the missing status
                await expect(bicycleComponentV1.connect(customer).setMissingStatus(serialNumber, true))
                    .to.be.revertedWith("The sender does not have the right to report on this token");
            });

            it("Should allow the minter to set the missing status even after transfer", async function () {
                const {bicycleComponentV1, serialNumber, shop, customer, third} = await loadFixture(registerComponent);
                expect(await bicycleComponentV1.missingStatus(serialNumber)).to.be.false;

                // Transfer to `third`
                await bicycleComponentV1.connect(customer).transfer(serialNumber, third.address);

                // Minter tries to set the missing status
                await bicycleComponentV1.connect(shop).setMissingStatus(serialNumber, true);
                expect(await bicycleComponentV1.missingStatus(serialNumber)).to.be.true;
            });

            it("Should not allow the minter to set status if the customer has revoked it", async function () {
                const {bicycleComponentV1, admin, shop, customer, serialNumber, tokenId} = await loadFixture(registerComponent);
                expect(await bicycleComponentV1.missingStatus(serialNumber)).to.be.false;

                // Current owner revokes the minter's approval
                await bicycleComponentV1.connect(customer).setTokenOperatorApproval(tokenId, shop.address, false);

                // Minter tries to set the missing status
                await expect(bicycleComponentV1.connect(shop).setMissingStatus(serialNumber, true))
                    .to.be.revertedWith("The sender does not have the right to report on this token");

                // But an admin can still set the missing status
                await expect(bicycleComponentV1.connect(admin).setMissingStatus(serialNumber, true))
                    .to.emit(bicycleComponentV1, "MissingStatusUpdated")
            });

            it("Should emit a 'MissingStatusUpdated' event after a successful update", async function () {
                const {bicycleComponentV1, serialNumber, customer} = await loadFixture(registerComponent);
                expect(await bicycleComponentV1.missingStatus(serialNumber)).to.be.false;

                await expect(bicycleComponentV1.connect(customer).setMissingStatus(serialNumber, true))
                    .to.emit(bicycleComponentV1, "MissingStatusUpdated")
                    .withArgs(serialNumber, true);
            });
        });
    });
});
