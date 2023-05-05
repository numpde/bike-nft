import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers, upgrades} from "hardhat";

async function deployBicycleComponentManagerFixture() {
    const [deployer, admin, manager, upgrader, pauser, shop, customer, third] = await ethers.getSigners();

    // First deploy the managed contract

    const BicycleComponents = await ethers.getContractFactory("BicycleComponents");

    const componentsContract = await upgrades.deployProxy(BicycleComponents, [], {
        initializer: 'initialize',
        kind: 'uups',
        value: 0
    });

    // Then deploy the manager contract

    const BicycleComponentManager = await ethers.getContractFactory("BicycleComponentManager");

    const managerContract = await upgrades.deployProxy(BicycleComponentManager, [], {
        initializer: 'initialize',
        kind: 'uups',
        value: 0
    });

    // Link the manager contract to the managed contract
    await managerContract.connect(deployer).setNftContractAddress(componentsContract.address);

    // Register the manager contract with the managed contract
    await componentsContract.connect(deployer).hireManager(managerContract.address);

    // Grant the admin role to the admin
    await managerContract.connect(deployer).grantRole(managerContract.DEFAULT_ADMIN_ROLE(), admin.address);

    // Grant the minter role to the shop
    await managerContract.connect(deployer).grantRole(managerContract.MINTER_ROLE(), shop.address);

    return {componentsContract, managerContract, deployer, admin, manager, upgrader, pauser, shop, customer, third};
}

async function registerComponent() {
    const {managerContract, shop, customer, ...etc} = await loadFixture(deployBicycleComponentManagerFixture);

    const serialNumber = "SN12345678";
    const uri = "https://example.com/" + serialNumber;

    const tokenId = await managerContract.generateTokenId(serialNumber);

    await managerContract.connect(shop).register(customer.address, serialNumber, uri);

    return {managerContract, shop, customer, serialNumber, uri, tokenId, ...etc};
}

describe("BicycleComponentManager", function () {
    describe("Deployment", function () {
        it("Should deploy", async function () {
            const {managerContract} = await loadFixture(deployBicycleComponentManagerFixture);
            await expect(managerContract.address).to.not.be.null;
            await expect(managerContract.address).to.not.be.undefined;
            await expect(managerContract.address).to.not.be.empty;
        });

        it("Should grant initial roles to the deployer", async function () {
            const {managerContract, deployer} = await loadFixture(deployBicycleComponentManagerFixture);

            const roles = ["DEFAULT_ADMIN_ROLE", "PAUSER_ROLE", "MINTER_ROLE", "UPGRADER_ROLE"];

            for (const role of roles) {
                await expect(await managerContract.hasRole(managerContract[role](), deployer.address)).to.be.true;
            }
        });
    });

    describe("Serial number", function () {
        it("Should generate a consistent tokenId from serialNumber", async function () {
            const {managerContract} = await loadFixture(deployBicycleComponentManagerFixture);

            const serialNumber = "SN12345678";
            const tokenId = await managerContract.generateTokenId(serialNumber);

            await expect(tokenId).to.equal(ethers.BigNumber.from("71287863191742338490528408279695658820772154164895693571530902880079996237432"));
        });
    });

    describe("Payment", function () {
        it("Should deploy with zero `minAmountOnRegister`", async function () {
            const {managerContract} = await loadFixture(deployBicycleComponentManagerFixture);

            const minAmountOnRegister = await managerContract.minAmountOnRegister();
            await expect(minAmountOnRegister).to.equal(0);
        });

        it("Should deploy with zero `maxAmountOnRegister`", async function () {
            const {managerContract} = await loadFixture(deployBicycleComponentManagerFixture);

            const minAmountOnRegister = await managerContract.maxAmountOnRegister();
            await expect(minAmountOnRegister).to.equal(0);
        });

        it("Should allow an admin to set amounts", async function () {
            const {managerContract, admin} = await loadFixture(deployBicycleComponentManagerFixture);

            // Min amount

            const newMinAmountOnRegister = ethers.utils.parseUnits("0.001", "ether");
            await managerContract.connect(admin).setMinAmountOnRegister(newMinAmountOnRegister);

            const minAmountOnRegister = await managerContract.minAmountOnRegister();
            await expect(minAmountOnRegister).to.equal(newMinAmountOnRegister);

            // Max amount

            const newMaxAmountOnRegister = ethers.utils.parseUnits("100", "ether");
            await managerContract.connect(admin).setMaxAmountOnRegister(newMaxAmountOnRegister);

            const maxAmountOnRegister = await managerContract.maxAmountOnRegister();
            await expect(maxAmountOnRegister).to.equal(newMaxAmountOnRegister);
        });

        it("Should not allow a non-admin to set amounts", async function () {
            const {managerContract, shop} = await loadFixture(deployBicycleComponentManagerFixture);

            const reason = "AccessControl: account " + shop.address.toLowerCase() + " is missing role " + await managerContract.DEFAULT_ADMIN_ROLE();

            // Min amount

            const newMinAmountOnRegister = ethers.utils.parseUnits("0.001", "ether");
            const action1 = managerContract.connect(shop).setMinAmountOnRegister(newMinAmountOnRegister);
            await expect(action1).to.be.revertedWith(reason);

            // Max amount

            const newMaxAmountOnRegister = ethers.utils.parseUnits("100", "ether");
            const action2 = managerContract.connect(shop).setMaxAmountOnRegister(newMaxAmountOnRegister);
            await expect(action2).to.be.revertedWith(reason);
        });

        it("Should revert if underfunded when registering", async function () {
            const {
                managerContract,
                admin,
                shop,
                customer
            } = await loadFixture(deployBicycleComponentManagerFixture);

            const minAmountOnRegister = ethers.utils.parseUnits("2", "ether");
            await managerContract.connect(admin).setMinAmountOnRegister(minAmountOnRegister);

            const serialNumber = "SN12345678";
            const uri = "https://example.com/" + serialNumber;
            const value = ethers.utils.parseUnits("1", "ether");

            const action = managerContract.connect(shop).register(customer.address, serialNumber, uri, {value: value});

            await expect(action).to.be.revertedWith("Insufficient payment");
        });

        it("Should return excess funds when registering a component", async function () {
            const {managerContract, admin, shop, customer} = await loadFixture(deployBicycleComponentManagerFixture);

            const maxAmountOnRegister = ethers.utils.parseUnits("1", "ether");
            await managerContract.connect(admin).setMaxAmountOnRegister(maxAmountOnRegister);

            const serialNumber = "SN12345678";
            const uri = "https://example.com/" + serialNumber;
            const valueToSend = ethers.utils.parseUnits("2", "ether");

            await expect(valueToSend).to.be.gt(maxAmountOnRegister);

            // Initially, the contract's balance is zero
            await expect(await ethers.provider.getBalance(managerContract.address)).to.equal(0);

            // Register with an amount that is more than the minimum
            await managerContract.connect(shop).register(customer.address, serialNumber, uri, {value: valueToSend});

            // Check that the contract's balance is "valueToSend - maxAmountOnRegister"
            const contractBalance = await ethers.provider.getBalance(managerContract.address);
            await expect(contractBalance).to.equal(valueToSend.sub(maxAmountOnRegister));
        });

        it("Should allow an admin to withdraw the contract balance to the admin", async function () {
            const {managerContract, admin, shop, customer} = await loadFixture(deployBicycleComponentManagerFixture);

            const amount = 1_000_000_000;
            await managerContract.connect(admin).setMinAmountOnRegister(amount);
            await managerContract.connect(admin).setMaxAmountOnRegister(amount);

            await managerContract.connect(shop).register(customer.address, "SN", "URI", {value: amount});

            // Withdraw the contract balance to the admin to avoid counting gas
            const action = managerContract.connect(admin).withdraw();

            await expect(action).to.changeEtherBalances([managerContract, admin], [-amount, amount]);
        });

        it("Should allow an admin to withdraw the contract balance to any address", async function () {
            const {
                managerContract,
                admin,
                shop,
                customer,
                third
            } = await loadFixture(deployBicycleComponentManagerFixture);

            const thirdBalanceBefore = await ethers.provider.getBalance(third.address);

            const amount = ethers.utils.parseUnits("1", "ether");
            await managerContract.connect(admin).setMinAmountOnRegister(amount);
            await managerContract.connect(admin).setMaxAmountOnRegister(amount);

            await managerContract.connect(shop).register(customer.address, "SN", "URI", {value: amount});

            // Withdraw the contract balance to a `third` to avoid counting gas
            await managerContract.connect(admin).withdrawTo(third.address);

            // Check that the contract balance is now zero
            const newBalance = await ethers.provider.getBalance(managerContract.address);
            await expect(newBalance).to.equal(0);

            // Check that `third` has received the full contract balance
            const thirdBalance = await ethers.provider.getBalance(third.address);
            await expect(thirdBalance).to.equal(thirdBalanceBefore.add(amount));
        });

        it("Should not allow a non-admin to withdraw the contract balance", async function () {
            const {managerContract, shop, customer} = await loadFixture(deployBicycleComponentManagerFixture);

            await managerContract.connect(shop).register(customer.address, "SN", "URI", {value: 1});

            const action = managerContract.connect(shop).withdraw();
            const reason = "AccessControl: account " + shop.address.toLowerCase() + " is missing role " + await managerContract.DEFAULT_ADMIN_ROLE();

            await expect(action).to.be.revertedWith(reason);
        });

        it("Should revert if there is nothing to withdraw", async function () {
            const {managerContract, admin} = await loadFixture(deployBicycleComponentManagerFixture);
            await expect(managerContract.connect(admin).withdraw()).to.be.revertedWith("I'm broke");
        });
    });

    describe("Registration 1", function () {
        it("Should mint a token correctly on registration", async function () {
            const {
                managerContract,
                componentsContract,
                shop,
                customer
            } = await loadFixture(deployBicycleComponentManagerFixture);

            const serialNumber = "SN12345678";
            const uri = "https://example.com/" + serialNumber;

            const tokenId = managerContract.generateTokenId(serialNumber);

            await managerContract.connect(shop).register(customer.address, serialNumber, uri);

            // Check that the token exists in the components contract
            const tokenURI = await componentsContract.tokenURI(tokenId);
            await expect(tokenURI).to.equal(uri);

            // Check that the owner of the token is the customer
            const owner = await componentsContract.ownerOf(tokenId);
            await expect(owner).to.equal(customer.address);
        });

        it("Should fail if the registrar is not a minter", async function () {
            const {managerContract, third} = await loadFixture(deployBicycleComponentManagerFixture);

            const serialNumber = "SN_ILLICIT";

            const action = managerContract.connect(third).register(third.address, serialNumber, "URI");
            const reason = "AccessControl: account " + third.address.toLowerCase() + " is missing role " + await managerContract.MINTER_ROLE();

            await expect(action).to.be.revertedWith(reason);
        });

        it("Should emit a ComponentOperatorApprovalUpdated", async function () {
            const {managerContract, shop, third} = await loadFixture(deployBicycleComponentManagerFixture);

            const serialNumber = "SN12345678";

            const tokenId = await managerContract.generateTokenId(serialNumber);

            const action = managerContract.connect(shop).register(third.address, serialNumber, "URI");

            // Note: The shop grants itself the approval for the future.
            await expect(action)
                .to.emit(managerContract, "ComponentOperatorApprovalUpdated")
                .withArgs(shop.address, serialNumber, tokenId, true);
        });

        it("Should emit a ComponentRegistered", async function () {
            const {managerContract, shop, customer} = await loadFixture(deployBicycleComponentManagerFixture);

            const serialNumber = "SN12345678";
            const uri = "https://example.com/" + serialNumber;

            const tokenId = await managerContract.generateTokenId(serialNumber);

            await expect(managerContract.connect(shop).register(customer.address, serialNumber, uri))
                .to.emit(managerContract, "ComponentRegistered")
                .withArgs(customer.address, serialNumber, tokenId, uri);
        });
    });

    describe("Registration 2", function () {
        it("Should approve the registrar as operator for the component", async function () {
            const {managerContract, shop, serialNumber} = await loadFixture(registerComponent);
            const isApproved = await managerContract.componentOperatorApproval(serialNumber, shop.address);

            await expect(isApproved).to.be.true;
        });

        it("Should not allow to register the same serial number twice", async function () {
            const {managerContract, shop, third, serialNumber, uri} = await loadFixture(registerComponent);

            await expect(managerContract.connect(shop).register(third.address, serialNumber, uri))
                .to.be.revertedWith("ERC721: token already minted");
        });
    });

    describe("componentOperatorApproval", function () {
        it("Should be false for a generic owner of a token", async function () {
            const {managerContract, serialNumber, customer} = await loadFixture(registerComponent);

            const isApproved = await managerContract.componentOperatorApproval(serialNumber, customer.address);
            await expect(isApproved).to.equal(false);
        });

        it("Should be false for a third party", async function () {
            const {managerContract, serialNumber, third} = await loadFixture(registerComponent);

            const isApproved = await managerContract.componentOperatorApproval(serialNumber, third.address);
            await expect(isApproved).to.equal(false);
        });

        it("Should set approval for a given operator and tokenId", async function () {
            const {managerContract, admin, serialNumber, third} = await loadFixture(registerComponent);

            const isApprovedBefore = await managerContract.componentOperatorApproval(serialNumber, third.address);
            await expect(isApprovedBefore).to.be.false;

            await managerContract.connect(admin).setComponentOperatorApproval(serialNumber, third.address, true);

            const isApprovedAfter = await managerContract.componentOperatorApproval(serialNumber, third.address);
            await expect(isApprovedAfter).to.be.true;
        });

        it("Should emit ComponentOperatorApprovalUpdated event", async function () {
            const {managerContract, admin, serialNumber, tokenId, third} = await loadFixture(registerComponent);

            await expect(managerContract.connect(admin).setComponentOperatorApproval(serialNumber, third.address, true))
                .to.emit(managerContract, "ComponentOperatorApprovalUpdated")
                .withArgs(third.address, serialNumber, tokenId, true);

            await expect(managerContract.connect(admin).setComponentOperatorApproval(serialNumber, third.address, false))
                .to.emit(managerContract, "ComponentOperatorApprovalUpdated")
                .withArgs(third.address, serialNumber, tokenId, false);
        });

        it("Should allow setting approval for a non-existing component", async function () {
            const {managerContract, deployer, third} = await loadFixture(registerComponent);

            const action = managerContract.connect(deployer).setComponentOperatorApproval("SNX", third.address, true);

            await expect(action).to.be.revertedWith("ERC721: invalid token ID");
        });

        it("Should not allow setting approval for a component not managed by the sender", async function () {
            const {managerContract, serialNumber, shop, customer, third} = await loadFixture(registerComponent);

            function approve(address) {
                return managerContract.connect(third).setComponentOperatorApproval(serialNumber, address, true);
            }

            const reason = "Insufficient rights";

            await expect(approve(shop.address)).to.be.revertedWith(reason);
            await expect(approve(third.address)).to.be.revertedWith(reason);
            await expect(approve(customer.address)).to.be.revertedWith(reason);
        });

        it("Should allow granting approval to the component owner", async function () {
            const {
                managerContract,
                componentsContract,
                serialNumber,
                tokenId,
                customer
            } = await loadFixture(registerComponent);

            const ownerOf = await componentsContract.ownerOf(tokenId);
            await expect(ownerOf).to.equal(customer.address);

            const isApprovedBefore = await managerContract.componentOperatorApproval(serialNumber, customer.address);
            await expect(isApprovedBefore).to.be.false;

            await expect(managerContract.setComponentOperatorApproval(serialNumber, customer.address, true)).to.not.be.reverted;

            const isApprovedAfter = await managerContract.componentOperatorApproval(serialNumber, customer.address);
            await expect(isApprovedAfter).to.be.true;
        });

        it("Should allow the simple owner/customer to manage approval", async function () {
            const {
                managerContract,
                componentsContract,
                serialNumber,
                tokenId,
                customer,
                third
            } = await loadFixture(registerComponent);

            const ownerOf = await componentsContract.ownerOf(tokenId);
            await expect(ownerOf).to.equal(customer.address);

            // Customer does not have a special role

            const roles = ["DEFAULT_ADMIN_ROLE", "PAUSER_ROLE", "MINTER_ROLE", "UPGRADER_ROLE"];

            for (const role of roles) {
                await expect(await managerContract.hasRole(managerContract[role](), customer.address)).to.be.false;
            }

            // Initially, neither customer nor third are approved operators
            await expect(await managerContract.componentOperatorApproval(serialNumber, customer.address)).to.be.false;
            await expect(await managerContract.componentOperatorApproval(serialNumber, third.address)).to.be.false;

            // Customer grants approval to third
            await managerContract.connect(customer).setComponentOperatorApproval(serialNumber, third.address, true);
            await expect(await managerContract.componentOperatorApproval(serialNumber, third.address)).to.be.true;

            // Customer revokes approval from third
            await managerContract.connect(customer).setComponentOperatorApproval(serialNumber, third.address, false);
            await expect(await managerContract.componentOperatorApproval(serialNumber, third.address)).to.be.false;
        });

        it("Should allow the operator to also manage approval for this token", async function () {
            // Note: This behavior is dubious, and should be reconsidered.

            const {
                managerContract,
                serialNumber,
                tokenId,
                shop,
                customer,
                third
            } = await loadFixture(registerComponent);

            // Initially, `shop` has approval
            await expect(await managerContract.componentOperatorApproval(serialNumber, shop.address)).to.be.true;

            // For example, `shop` can mark the component as missing
            const action1 = managerContract.connect(shop).setMissingStatus(serialNumber, true);
            await expect(action1).not.to.be.reverted;

            // Customer gives approval to `third`
            await managerContract.connect(customer).setComponentOperatorApproval(serialNumber, third.address, true);

            // Approval of `shop` is revoked by `third`
            await managerContract.connect(third).setComponentOperatorApproval(serialNumber, shop.address, false);

            // Now, `shop` does not have approval
            await expect(await managerContract.componentOperatorApproval(tokenId, shop.address)).to.be.false;

            // For example, `shop` can no longer mark the component as missing
            const action2 = managerContract.connect(shop).setMissingStatus(serialNumber, true);
            await expect(action2).to.be.revertedWith("Insufficient rights");
        });

        it("Should allow the operator to transfer the component", async function () {
            const {
                managerContract,
                componentsContract,
                customer,
                third,
                serialNumber,
                tokenId
            } = await loadFixture(registerComponent);

            // Customer gives approval to `third`
            await managerContract.connect(customer).setComponentOperatorApproval(serialNumber, third.address, true);

            // `third` performs the transfer
            await managerContract.connect(third).transfer(serialNumber, third.address);

            // `third` is now the owner
            const ownerAfter = await componentsContract.ownerOf(tokenId);
            await expect(ownerAfter).to.equal(third.address);
        });
    });

    describe("Transfer", function () {
        it("Should transfer the component to the specified address", async function () {
            const {
                managerContract,
                componentsContract,
                serialNumber,
                customer,
                third,
                tokenId
            } = await loadFixture(registerComponent);

            const ownerBefore = await componentsContract.ownerOf(tokenId);
            await expect(ownerBefore).to.equal(customer.address);

            await managerContract.connect(customer).transfer(serialNumber, third.address);

            const ownerAfter = await componentsContract.ownerOf(tokenId);
            await expect(ownerAfter).to.equal(third.address);
        });

        it("Should emit a Transfer event after a successful transfer", async function () {
            const {
                managerContract,
                componentsContract,
                serialNumber,
                customer,
                third,
                tokenId
            } = await loadFixture(registerComponent);

            await expect(managerContract.connect(customer).transfer(serialNumber, third.address))
                .to.emit(componentsContract, "Transfer")
                .withArgs(customer.address, third.address, tokenId);
        });

        it("Should emit a ComponentTransferred event after a successful transfer", async function () {
            const {managerContract, serialNumber, customer, third, tokenId} = await loadFixture(registerComponent);

            await expect(managerContract.connect(customer).transfer(serialNumber, third.address))
                .to.emit(managerContract, "ComponentTransferred")
                .withArgs(serialNumber, tokenId, third.address);
        });

        it("Should allow an admin to transfer a component", async function () {
            const {
                managerContract,
                componentsContract,
                admin,
                customer,
                serialNumber,
                third,
                tokenId
            } = await loadFixture(registerComponent);

            await expect(await componentsContract.ownerOf(tokenId)).to.equal(customer.address);

            const action = managerContract.connect(admin).transfer(serialNumber, third.address);
            await expect(action).to.emit(componentsContract, "Transfer");

            await expect(await componentsContract.ownerOf(tokenId)).to.equal(third.address);
        });

        it("Should fail if the serial number does not map to an existing token", async function () {
            const {managerContract, third, admin} = await loadFixture(registerComponent);

            const invalidSerialNumber = "SN_INVALID_007";

            const action = managerContract.connect(admin).transfer(invalidSerialNumber, third.address);

            await expect(action).to.be.revertedWith("ERC721: invalid token ID");
        });

        it("Should not allow a third party to transfer a token", async function () {
            const {managerContract, serialNumber, third} = await loadFixture(registerComponent);

            const action = managerContract.connect(third).transfer(serialNumber, third.address)

            await expect(action).to.be.revertedWith("Insufficient rights");
        });

        it("Should allow an operator to transfer a token", async function () {
            const {
                managerContract,
                componentsContract,
                serialNumber,
                third,
                tokenId
            } = await loadFixture(registerComponent);

            await managerContract.setComponentOperatorApproval(serialNumber, third.address, true);
            await managerContract.connect(third).transfer(serialNumber, third.address);
            await expect(await componentsContract.ownerOf(tokenId)).to.equal(third.address);
        });

        it("Should leave operator approval with the minter after transfer", async function () {
            const {
                managerContract,
                serialNumber,
                shop,
                customer,
                third,
                tokenId
            } = await loadFixture(registerComponent);

            await managerContract.connect(customer).transfer(serialNumber, third.address);

            const isApproved = await managerContract.componentOperatorApproval(serialNumber, shop.address);
            await expect(isApproved).to.equal(true);
        });
    });

    describe("Missing status", async function () {
        it("Should be `false` initially", async function () {
            const {managerContract, serialNumber} = await loadFixture(registerComponent);
            await expect(await managerContract.missingStatus(serialNumber)).to.be.false;
        });

        it("Should allow the owner to set the missing status of a component", async function () {
            const {managerContract, serialNumber, customer} = await loadFixture(registerComponent);
            await expect(await managerContract.missingStatus(serialNumber)).to.be.false;

            await managerContract.connect(customer).setMissingStatus(serialNumber, true);
            await expect(await managerContract.missingStatus(serialNumber)).to.be.true;
        });

        it("Should allow an admin to set the missing status of a component", async function () {
            const {managerContract, serialNumber} = await loadFixture(registerComponent);
            await expect(await managerContract.missingStatus(serialNumber)).to.be.false;

            await managerContract.setMissingStatus(serialNumber, true);
            await expect(await managerContract.missingStatus(serialNumber)).to.be.true;
        });

        it("Should not allow the previous owner to set the missing status", async function () {
            const {managerContract, serialNumber, customer, third} = await loadFixture(registerComponent);

            // Transfer to `third`
            await managerContract.connect(customer).transfer(serialNumber, third.address);

            // Previous owner tries to set the missing status
            const action = managerContract.connect(customer).setMissingStatus(serialNumber, true);
            await expect(action).to.be.revertedWith("Insufficient rights");
        });

        it("Should allow the minter to set the missing status even after transfer", async function () {
            const {managerContract, serialNumber, shop, customer, third} = await loadFixture(registerComponent);

            // Transfer to `third`
            await managerContract.connect(customer).transfer(serialNumber, third.address);

            // Minter tries to set the missing status
            await managerContract.connect(shop).setMissingStatus(serialNumber, true);
            await expect(await managerContract.missingStatus(serialNumber)).to.be.true;
        });

        it("Should not allow the minter to set status if the customer has revoked approval", async function () {
            const {
                managerContract,
                admin,
                shop,
                customer,
                serialNumber,
                tokenId
            } = await loadFixture(registerComponent);

            // Current owner revokes the minter's approval
            await managerContract.connect(customer).setComponentOperatorApproval(serialNumber, shop.address, false);

            // Minter tries to set the missing status
            await expect(managerContract.connect(shop).setMissingStatus(serialNumber, true))
                .to.be.revertedWith("Insufficient rights");

            // But an admin can still set the missing status
            await expect(managerContract.connect(admin).setMissingStatus(serialNumber, true))
                .to.emit(managerContract, "MissingStatusUpdated")
        });

        it("Should emit a MissingStatusUpdated after a successful update", async function () {
            const {managerContract, serialNumber, tokenId, customer} = await loadFixture(registerComponent);

            await expect(managerContract.connect(customer).setMissingStatus(serialNumber, true))
                .to.emit(managerContract, "MissingStatusUpdated")
                .withArgs(serialNumber, tokenId, true);
        });
    });
});
