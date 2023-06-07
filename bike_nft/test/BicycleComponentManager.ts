import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {ethers} from "hardhat";
import {expect} from "chai";

// noinspection TypeScriptCheckImport
import {Buffer} from 'buffer';

import {getSigners} from "./signers";
import {deployBicycleComponentManagerFixture, deployOpsFundFixture} from "./fixtures";

async function registerComponent(): Promise<any> {
    const {managerContract, shop1, ...etc} = await loadFixture(deployBicycleComponentManagerFixture);
    const {customer1} = await getSigners();

    const serialNumber = "SN12345678";
    const uri = "https://example.com/" + serialNumber;

    const tokenId = await managerContract.generateTokenId(serialNumber);

    await managerContract.connect(shop1).register(customer1.address, serialNumber, uri);

    return {managerContract, shop1, customer1, serialNumber, uri, tokenId, ...etc};
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

            const roles = ["DEFAULT_ADMIN_ROLE", "PAUSER_ROLE", "REGISTRAR_ROLE", "UPGRADER_ROLE"];

            for (const role of roles) {
                await expect(await managerContract.hasRole(managerContract[role](), deployer.address)).to.be.true;
            }
        });
    });

    describe("Connect to the NFT contract", function () {
        it("Should connect in fixture", async function () {
            const {managerContract, componentsContract} = await loadFixture(deployBicycleComponentManagerFixture);

            await expect(await managerContract.nftContract()).to.equal(componentsContract.address);
        });

        it("Should allow an admin to connect", async function () {
            const {managerContract, admin} = await loadFixture(deployBicycleComponentManagerFixture);

            const action = managerContract.connect(admin).setNftContractAddress(ethers.constants.AddressZero);
            await expect(action).to.not.be.reverted;
        });

        it("Should not allow a non-admin to connect", async function () {
            const {managerContract, shop1} = await loadFixture(deployBicycleComponentManagerFixture);

            const reason = "AccessControl: account " + shop1.address.toLowerCase() + " is missing role " + await managerContract.DEFAULT_ADMIN_ROLE();

            const action = managerContract.connect(shop1).setNftContractAddress(ethers.constants.AddressZero);
            await expect(action).to.be.revertedWith(reason);
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
            const {managerContract, shop1} = await loadFixture(deployBicycleComponentManagerFixture);

            const reason = "AccessControl: account " + shop1.address.toLowerCase() + " is missing role " + await managerContract.DEFAULT_ADMIN_ROLE();

            // Min amount

            const newMinAmountOnRegister = ethers.utils.parseUnits("0.001", "ether");
            const action1 = managerContract.connect(shop1).setMinAmountOnRegister(newMinAmountOnRegister);
            await expect(action1).to.be.revertedWith(reason);

            // Max amount

            const newMaxAmountOnRegister = ethers.utils.parseUnits("100", "ether");
            const action2 = managerContract.connect(shop1).setMaxAmountOnRegister(newMaxAmountOnRegister);
            await expect(action2).to.be.revertedWith(reason);
        });

        it("Should revert if underfunded when registering", async function () {
            const {managerContract, admin, shop1} = await loadFixture(deployBicycleComponentManagerFixture);
            const {customer1} = await getSigners();

            const minAmountOnRegister = ethers.utils.parseUnits("2", "ether");
            await managerContract.connect(admin).setMinAmountOnRegister(minAmountOnRegister);

            const serialNumber = "SN12345678";
            const uri = "https://example.com/" + serialNumber;
            const value = ethers.utils.parseUnits("1", "ether");

            const action = managerContract.connect(shop1).register(customer1.address, serialNumber, uri, {value: value});

            await expect(action).to.be.revertedWith("Insufficient payment");
        });

        it("Should return excess funds when registering a component", async function () {
            const {managerContract, admin, shop1} = await loadFixture(deployBicycleComponentManagerFixture);
            const {customer1} = await getSigners();

            const maxAmountOnRegister = ethers.utils.parseUnits("1", "ether");
            await managerContract.connect(admin).setMaxAmountOnRegister(maxAmountOnRegister);

            const serialNumber = "SN12345678";
            const uri = "https://example.com/" + serialNumber;
            const valueToSend = ethers.utils.parseUnits("2", "ether");

            await expect(valueToSend).to.be.gt(maxAmountOnRegister);

            // Initially, the contract's balance is zero
            await expect(await ethers.provider.getBalance(managerContract.address)).to.equal(0);

            // Register with an amount that is more than the minimum
            await managerContract.connect(shop1).register(customer1.address, serialNumber, uri, {value: valueToSend});

            // Check that the contract's balance is "valueToSend - maxAmountOnRegister"
            const contractBalance = await ethers.provider.getBalance(managerContract.address);
            await expect(contractBalance).to.equal(valueToSend.sub(maxAmountOnRegister));
        });

        it("Should allow an admin to withdraw the contract balance to the admin", async function () {
            const {managerContract, admin, shop1} = await loadFixture(deployBicycleComponentManagerFixture);
            const {customer1} = await getSigners();

            const amount = 1_000_000_000;
            await managerContract.connect(admin).setMinAmountOnRegister(amount);
            await managerContract.connect(admin).setMaxAmountOnRegister(amount);

            await managerContract.connect(shop1).register(customer1.address, "SN", "URI", {value: amount});

            // Withdraw the contract balance to the admin to avoid counting gas
            const action = managerContract.connect(admin).withdraw();

            await expect(action).to.changeEtherBalances([managerContract, admin], [-amount, amount]);
        });

        it("Should allow an admin to withdraw the contract balance to any address", async function () {
            const {managerContract, admin, shop1} = await loadFixture(deployBicycleComponentManagerFixture);
            const {customer1, third} = await getSigners();

            const thirdBalanceBefore = await ethers.provider.getBalance(third.address);

            const amount = ethers.utils.parseUnits("1", "ether");
            await managerContract.connect(admin).setMinAmountOnRegister(amount);
            await managerContract.connect(admin).setMaxAmountOnRegister(amount);

            await managerContract.connect(shop1).register(customer1.address, "SN", "URI", {value: amount});

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
            const {managerContract, shop1} = await loadFixture(deployBicycleComponentManagerFixture);
            const {customer1} = await getSigners();

            await managerContract.connect(shop1).register(customer1.address, "SN", "URI", {value: 1});

            const action = managerContract.connect(shop1).withdraw();
            const reason = "AccessControl: account " + shop1.address.toLowerCase() + " is missing role " + await managerContract.DEFAULT_ADMIN_ROLE();

            await expect(action).to.be.revertedWith(reason);
        });

        it("Should revert if there is nothing to withdraw", async function () {
            const {managerContract, admin} = await loadFixture(deployBicycleComponentManagerFixture);
            await expect(managerContract.connect(admin).withdraw()).to.be.revertedWith("I'm broke");
        });
    });

    describe("Registration 1", function () {
        it("Should mint a token correctly on registration", async function () {
            const {managerContract, componentsContract} = await loadFixture(deployBicycleComponentManagerFixture);
            const {shop1, customer1} = await getSigners();

            const serialNumber = "SN12345678";
            const uri = "https://example.com/" + serialNumber;

            const tokenId = managerContract.generateTokenId(serialNumber);

            await managerContract.connect(shop1).register(customer1.address, serialNumber, uri);

            // Check that the token exists in the components contract
            const tokenURI = await componentsContract.tokenURI(tokenId);
            await expect(tokenURI).to.equal(uri);

            // Check that the owner of the token is the customer
            const owner1 = await componentsContract.ownerOf(tokenId);
            await expect(owner1).to.equal(customer1.address);

            // Check the convenience function of the manager contract
            const owner2 = await managerContract.ownerOf(serialNumber);
            await expect(owner2).to.equal(customer1.address);
        });

        it("Should fail if the registrar is not a minter", async function () {
            const {managerContract} = await loadFixture(deployBicycleComponentManagerFixture);
            const {third} = await getSigners();

            const serialNumber = "SN_ILLICIT";

            const action = managerContract.connect(third).register(third.address, serialNumber, "URI");
            const reason = "BCM: Insufficient rights";

            await expect(action).to.be.revertedWith(reason);
        });

        it("Should emit a UpdatedComponentOperatorApproval", async function () {
            const {managerContract} = await loadFixture(deployBicycleComponentManagerFixture);
            const {shop1, third} = await getSigners();

            const serialNumber = "SN12345678";

            const tokenId = await managerContract.generateTokenId(serialNumber);

            const action = managerContract.connect(shop1).register(third.address, serialNumber, "URI");

            // Note: The shop grants itself the approval for the future.
            await expect(action)
                .to.emit(managerContract, "UpdatedComponentOperatorApproval")
                .withArgs(shop1.address, serialNumber, tokenId, true);
        });

        it("Should emit a ComponentRegistered", async function () {
            const {managerContract} = await loadFixture(deployBicycleComponentManagerFixture);
            const {shop1, customer1} = await getSigners();

            const serialNumber = "SN12345678";
            const uri = "https://example.com/" + serialNumber;

            const tokenId = await managerContract.generateTokenId(serialNumber);

            await expect(managerContract.connect(shop1).register(customer1.address, serialNumber, uri))
                .to.emit(managerContract, "ComponentRegistered")
                .withArgs(customer1.address, serialNumber, tokenId, uri);
        });
    });

    describe("Registration 2", function () {
        it("Should approve the registrar as operator for the component", async function () {
            const {managerContract, shop1, serialNumber} = await loadFixture(registerComponent);
            const isApproved = await managerContract.componentOperatorApproval(serialNumber, shop1.address);

            await expect(isApproved).to.be.true;
        });

        it("Should not allow to register the same serial number twice", async function () {
            const {managerContract, shop1, serialNumber, uri} = await loadFixture(registerComponent);
            const {third} = await getSigners();

            await expect(managerContract.connect(shop1).register(third.address, serialNumber, uri))
                .to.be.revertedWith("ERC721: token already minted");
        });
    });

    describe("Component URI", function () {
        it("Should allow an admin/minter/owner to change component URI", async function () {
            const {managerContract, serialNumber} = await loadFixture(registerComponent);
            const {admin, shop1, customer1} = await getSigners();

            for (const account of [admin, shop1, customer1]) {
                const uri = "https://example.com/" + serialNumber + "/" + account.address;

                const action = managerContract.connect(account).setComponentURI(serialNumber, uri);
                await expect(action).to.emit(managerContract, "UpdatedComponentURI");

                await expect(await managerContract.componentURI(serialNumber)).to.equal(uri);
            }
        });

        it("Should not allow a third party to change component URI", async function () {
            const {managerContract, serialNumber} = await loadFixture(registerComponent);
            const {third} = await getSigners();

            const uri = "https://example.com/" + serialNumber + "/" + third.address;

            const action = managerContract.connect(third).setComponentURI(serialNumber, uri);
            const reason = "BCM: Insufficient rights";

            await expect(action).to.be.revertedWith(reason);
        });

        it("Should set the on-chain metadata correctly", async function () {
            const {managerContract, customer1, serialNumber} = await loadFixture(registerComponent);

            interface BikeData {
                name: string;
                description: string;
                image: string;
            }

            const referenceMetadata: BikeData = {
                name: "Scalpel HT Carbon 4",
                description: "A hardtail with razor-sharp precision, Shimano shifting & 100mm RockShox SID fork",
                image: "https://embed.widencdn.net/img/dorelrl/24egss6ejx/1700px@1x/C21_C25401U_Scalpel_HT_Crb_4_ARD_3Q.webp?color=f3f3f3&q=95",
            }

            const action = managerContract.connect(customer1).setOnChainComponentMetadata(
                serialNumber, referenceMetadata.name, referenceMetadata.description, referenceMetadata.image
            );

            await expect(action).to.emit(managerContract, "UpdatedComponentURI");

            // Now check the on-chain metadata

            function decodeURI(uri: string): BikeData {
                const prefix = "data:application/json;base64,";
                const base64EncodedJson = uri.startsWith(prefix) ? uri.slice(prefix.length) : uri;
                const decodedJson = Buffer.from(base64EncodedJson, 'base64').toString('utf8');

                return JSON.parse(decodedJson);
            }

            const uri = await managerContract.componentURI(serialNumber);
            const candidateMetadata: BikeData = decodeURI(uri);

            await expect(candidateMetadata).to.deep.equal(referenceMetadata);
        });
    });

    describe("Component operator approval", function () {
        it("Should be false for a generic owner of a token", async function () {
            const {managerContract, serialNumber, customer1} = await loadFixture(registerComponent);

            const isApproved = await managerContract.componentOperatorApproval(serialNumber, customer1.address);
            await expect(isApproved).to.equal(false);
        });

        it("Should be false for a third party", async function () {
            const {managerContract, serialNumber} = await loadFixture(registerComponent);
            const {third} = await getSigners();

            const isApproved = await managerContract.componentOperatorApproval(serialNumber, third.address);
            await expect(isApproved).to.equal(false);
        });

        it("Should set approval for a given operator and tokenId", async function () {
            const {managerContract, serialNumber} = await loadFixture(registerComponent);
            const {admin, third} = await getSigners();

            const isApprovedBefore = await managerContract.componentOperatorApproval(serialNumber, third.address);
            await expect(isApprovedBefore).to.be.false;

            await managerContract.connect(admin).setComponentOperatorApproval(serialNumber, third.address, true);

            const isApprovedAfter = await managerContract.componentOperatorApproval(serialNumber, third.address);
            await expect(isApprovedAfter).to.be.true;
        });

        it("Should emit UpdatedComponentOperatorApproval event", async function () {
            const {managerContract, serialNumber, tokenId} = await loadFixture(registerComponent);
            const {admin, third} = await getSigners();

            await expect(managerContract.connect(admin).setComponentOperatorApproval(serialNumber, third.address, true))
                .to.emit(managerContract, "UpdatedComponentOperatorApproval")
                .withArgs(third.address, serialNumber, tokenId, true);

            await expect(managerContract.connect(admin).setComponentOperatorApproval(serialNumber, third.address, false))
                .to.emit(managerContract, "UpdatedComponentOperatorApproval")
                .withArgs(third.address, serialNumber, tokenId, false);
        });

        it("Should not allow setting approval for a non-existing component", async function () {
            const {managerContract} = await loadFixture(registerComponent);
            const {deployer, third} = await getSigners();

            const action = managerContract.connect(deployer).setComponentOperatorApproval("SNX", third.address, true);

            await expect(action).to.be.revertedWith("Serial number not registered");
        });

        it("Should not allow setting approval for a component not managed by the sender", async function () {
            const {managerContract, serialNumber} = await loadFixture(registerComponent);
            const {shop1, customer1, third} = await getSigners();

            function approve(address: string) {
                return managerContract.connect(third).setComponentOperatorApproval(serialNumber, address, true);
            }

            const reason = "BCM: Insufficient rights";

            await expect(approve(shop1.address)).to.be.revertedWith(reason);
            await expect(approve(third.address)).to.be.revertedWith(reason);
            await expect(approve(customer1.address)).to.be.revertedWith(reason);
        });

        it("Should allow granting approval to the component owner", async function () {
            const {managerContract, componentsContract, serialNumber, tokenId} = await loadFixture(registerComponent);
            const {customer1} = await getSigners();

            const ownerOf = await componentsContract.ownerOf(tokenId);
            await expect(ownerOf).to.equal(customer1.address);

            const isApprovedBefore = await managerContract.componentOperatorApproval(serialNumber, customer1.address);
            await expect(isApprovedBefore).to.be.false;

            await expect(managerContract.setComponentOperatorApproval(serialNumber, customer1.address, true)).to.not.be.reverted;

            const isApprovedAfter = await managerContract.componentOperatorApproval(serialNumber, customer1.address);
            await expect(isApprovedAfter).to.be.true;
        });

        it("Should allow the simple owner/customer to manage approval", async function () {
            const {
                managerContract,
                componentsContract,
                serialNumber,
                tokenId,
                customer1
            } = await loadFixture(registerComponent);

            const {third} = await getSigners();

            const ownerOf = await componentsContract.ownerOf(tokenId);
            await expect(ownerOf).to.equal(customer1.address);

            // Customer does not have a special role

            const roles = ["DEFAULT_ADMIN_ROLE", "PAUSER_ROLE", "REGISTRAR_ROLE", "UPGRADER_ROLE"];

            for (const role of roles) {
                await expect(await managerContract.hasRole(managerContract[role](), customer1.address)).to.be.false;
            }

            // Initially, neither customer nor third are approved operators
            await expect(await managerContract.componentOperatorApproval(serialNumber, customer1.address)).to.be.false;
            await expect(await managerContract.componentOperatorApproval(serialNumber, third.address)).to.be.false;

            // Customer grants approval to third
            await managerContract.connect(customer1).setComponentOperatorApproval(serialNumber, third.address, true);
            await expect(await managerContract.componentOperatorApproval(serialNumber, third.address)).to.be.true;

            // Customer revokes approval from third
            await managerContract.connect(customer1).setComponentOperatorApproval(serialNumber, third.address, false);
            await expect(await managerContract.componentOperatorApproval(serialNumber, third.address)).to.be.false;
        });

        it("Should allow the operator to also manage approval for this token", async function () {
            // Note: This behavior is dubious, and should be reconsidered.

            const {
                managerContract,
                serialNumber,
                tokenId,
                shop1,
                customer1
            } = await loadFixture(registerComponent);

            const {third} = await getSigners();

            // Initially, `shop` has approval
            await expect(await managerContract.componentOperatorApproval(serialNumber, shop1.address)).to.be.true;

            // For example, `shop` can mark the component as missing
            const action1 = managerContract.connect(shop1).setMissingStatus(serialNumber, true);
            await expect(action1).not.to.be.reverted;

            // Customer gives approval to `third`
            await managerContract.connect(customer1).setComponentOperatorApproval(serialNumber, third.address, true);

            // Approval of `shop` is revoked by `third`
            await managerContract.connect(third).setComponentOperatorApproval(serialNumber, shop1.address, false);

            // Now, `shop` does not have approval
            await expect(await managerContract.componentOperatorApproval(tokenId, shop1.address)).to.be.false;

            // For example, `shop` can no longer mark the component as missing
            const action2 = managerContract.connect(shop1).setMissingStatus(serialNumber, true);
            await expect(action2).to.be.revertedWith("BCM: Insufficient rights");
        });

        it("Should allow the operator to transfer the component", async function () {
            const {
                managerContract,
                componentsContract,
                customer1,
                serialNumber,
                tokenId
            } = await loadFixture(registerComponent);

            const {third} = await getSigners();

            // Customer gives approval to `third`
            await managerContract.connect(customer1).setComponentOperatorApproval(serialNumber, third.address, true);

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
                tokenId
            } = await loadFixture(registerComponent);

            const {customer1, third} = await getSigners();

            const ownerBefore = await componentsContract.ownerOf(tokenId);
            await expect(ownerBefore).to.equal(customer1.address);

            await managerContract.connect(customer1).transfer(serialNumber, third.address);

            const ownerAfter = await componentsContract.ownerOf(tokenId);
            await expect(ownerAfter).to.equal(third.address);
        });

        it("Should emit a Transfer event after a successful transfer", async function () {
            const {
                managerContract,
                componentsContract,
                serialNumber,
                customer1,
                tokenId
            } = await loadFixture(registerComponent);

            const {third} = await getSigners();

            await expect(managerContract.connect(customer1).transfer(serialNumber, third.address))
                .to.emit(componentsContract, "Transfer")
                .withArgs(customer1.address, third.address, tokenId);
        });

        it("Should emit a ComponentTransferred event after a successful transfer", async function () {
            const {managerContract, serialNumber, tokenId} = await loadFixture(registerComponent);
            const {customer1, third} = await getSigners();

            await expect(managerContract.connect(customer1).transfer(serialNumber, third.address))
                .to.emit(managerContract, "ComponentTransferred")
                .withArgs(serialNumber, tokenId, third.address);
        });

        it("Should allow an admin to transfer a component", async function () {
            const {
                managerContract,
                componentsContract,
                serialNumber,
                tokenId
            } = await loadFixture(registerComponent);

            const {customer1, third, admin} = await getSigners();

            await expect(await componentsContract.ownerOf(tokenId)).to.equal(customer1.address);

            const action = managerContract.connect(admin).transfer(serialNumber, third.address);
            await expect(action).to.emit(componentsContract, "Transfer");

            await expect(await componentsContract.ownerOf(tokenId)).to.equal(third.address);
        });

        it("Should fail if the serial number does not map to an existing token", async function () {
            const {managerContract} = await loadFixture(registerComponent);
            const {third, admin} = await getSigners();

            const invalidSerialNumber = "SN_INVALID_007";

            const action = managerContract.connect(admin).transfer(invalidSerialNumber, third.address);

            await expect(action).to.be.revertedWith("Serial number not registered");
        });

        it("Should not allow a third party to transfer a token", async function () {
            const {managerContract, serialNumber} = await loadFixture(registerComponent);
            const {third} = await getSigners();

            const action = managerContract.connect(third).transfer(serialNumber, third.address)

            await expect(action).to.be.revertedWith("BCM: Insufficient rights");
        });

        it("Should allow an operator to transfer a token", async function () {
            const {
                managerContract,
                componentsContract,
                serialNumber,
                tokenId
            } = await loadFixture(registerComponent);

            const {third} = await getSigners();

            await managerContract.setComponentOperatorApproval(serialNumber, third.address, true);
            await managerContract.connect(third).transfer(serialNumber, third.address);
            await expect(await componentsContract.ownerOf(tokenId)).to.equal(third.address);
        });

        it("Should leave operator approval with the minter after transfer", async function () {
            const {managerContract, serialNumber} = await loadFixture(registerComponent);
            const {shop1, customer1, third} = await getSigners();

            await managerContract.connect(customer1).transfer(serialNumber, third.address);

            const isApproved = await managerContract.componentOperatorApproval(serialNumber, shop1.address);
            await expect(isApproved).to.equal(true);
        });
    });

    describe("Missing status", async function () {
        it("Should be `false` initially", async function () {
            const {managerContract, serialNumber} = await loadFixture(registerComponent);
            await expect(await managerContract.missingStatus(serialNumber)).to.be.false;
        });

        it("Should allow the owner to set the missing status of a component", async function () {
            const {managerContract, serialNumber, customer1} = await loadFixture(registerComponent);
            await expect(await managerContract.missingStatus(serialNumber)).to.be.false;

            await managerContract.connect(customer1).setMissingStatus(serialNumber, true);
            await expect(await managerContract.missingStatus(serialNumber)).to.be.true;
        });

        it("Should allow an admin to set the missing status of a component", async function () {
            const {managerContract, serialNumber} = await loadFixture(registerComponent);
            await expect(await managerContract.missingStatus(serialNumber)).to.be.false;

            await managerContract.setMissingStatus(serialNumber, true);
            await expect(await managerContract.missingStatus(serialNumber)).to.be.true;
        });

        it("Should not allow the previous owner to set the missing status", async function () {
            const {managerContract, serialNumber} = await loadFixture(registerComponent);
            const {customer1, third} = await getSigners();

            // Transfer to `third`
            await managerContract.connect(customer1).transfer(serialNumber, third.address);

            // Previous owner tries to set the missing status
            const action = managerContract.connect(customer1).setMissingStatus(serialNumber, true);
            await expect(action).to.be.revertedWith("BCM: Insufficient rights");
        });

        it("Should allow the minter to set the missing status even after transfer", async function () {
            const {managerContract, serialNumber} = await loadFixture(registerComponent);
            const {shop1, customer1, third} = await getSigners();

            // Transfer to `third`
            await managerContract.connect(customer1).transfer(serialNumber, third.address);

            // Minter tries to set the missing status
            await managerContract.connect(shop1).setMissingStatus(serialNumber, true);
            await expect(await managerContract.missingStatus(serialNumber)).to.be.true;
        });

        it("Should not allow another minter to set the missing status", async function () {
            const {managerContract, serialNumber} = await loadFixture(registerComponent);
            const {admin, shop2} = await getSigners();

            // Grant `another_shop` the minter role
            await managerContract.connect(admin).grantRole(managerContract.REGISTRAR_ROLE(), shop2.address);

            // `another_shop` does not have operator approval for this component
            const isApproved = await managerContract.componentOperatorApproval(serialNumber, shop2.address);
            await expect(isApproved).to.be.false;

            const action = managerContract.connect(shop2).setMissingStatus(serialNumber, true);
            await expect(action).to.be.revertedWith("BCM: Insufficient rights");
        });

        it("Should not allow the minter to set status if the customer has revoked approval", async function () {
            const {managerContract, serialNumber} = await loadFixture(registerComponent);
            const {admin, shop1, customer1} = await getSigners();

            // Current owner revokes the minter's approval
            await managerContract.connect(customer1).setComponentOperatorApproval(serialNumber, shop1.address, false);

            // Minter tries to set the missing status
            await expect(managerContract.connect(shop1).setMissingStatus(serialNumber, true))
                .to.be.revertedWith("BCM: Insufficient rights");

            // But an admin can still set the missing status
            await expect(managerContract.connect(admin).setMissingStatus(serialNumber, true))
                .to.emit(managerContract, "UpdatedMissingStatus")
        });

        it("Should emit a UpdatedMissingStatus after a successful update", async function () {
            const {managerContract, serialNumber, tokenId, customer1} = await loadFixture(registerComponent);

            await expect(managerContract.connect(customer1).setMissingStatus(serialNumber, true))
                .to.emit(managerContract, "UpdatedMissingStatus")
                .withArgs(serialNumber, tokenId, true);
        });
    });

    describe("Account info", async function () {
        it("Should allow to set own account info", async function () {
            const {managerContract} = await loadFixture(registerComponent);
            const {third} = await getSigners();

            const info = `My account (${third.address})`;

            const action = managerContract.connect(third).setAccountInfo(third.address, info);
            await expect(action).to.emit(managerContract, "AccountInfoSet");

            const newAccountInfo = await managerContract.accountInfo(third.address);
            await expect(newAccountInfo).to.equal(info);
        });

        it("Should not allow a generic user to set other's info", async function () {
            const {managerContract} = await loadFixture(registerComponent);
            const {customer1, third} = await getSigners();

            const info = `My account (${third.address})`;
            const action = managerContract.connect(customer1).setAccountInfo(third.address, info);

            await expect(action).to.be.revertedWith("BCM: Insufficient rights");
        });

        it("Should allow an admin or minter to set other's info", async function () {
            const {managerContract, deployer} = await loadFixture(registerComponent);
            const {admin, shop1, third} = await getSigners();

            const info = `My account (${third.address})`;

            for (const account of [deployer, admin, shop1]) {
                const action = managerContract.connect(account).setAccountInfo(third.address, info);
                await expect(action).to.emit(managerContract, "AccountInfoSet");
            }
        });
    });

    describe("Interaction with BicycleComponentOpsFund", async function () {
        const setup = async function () {
            const {shop1, customer1} = await getSigners();

            const {managerContract} = await loadFixture(deployBicycleComponentManagerFixture);
            const {opsFundContract} = await loadFixture(deployOpsFundFixture);

            // Connect
            await opsFundContract.grantRole(opsFundContract.OPS_MANAGER_ROLE(), managerContract.address);
            await managerContract.setOpsFundContractAddress(opsFundContract.address);

            // Check current allowance: carte blanche for `shop1` and zero for `customer1`
            await expect(await opsFundContract.hasRole(opsFundContract.CARTE_BLANCHE_ROLE(), shop1.address)).to.be.true;
            await expect(await opsFundContract.allowanceOf(customer1.address)).to.equal(0);

            // shop1's allowance is maxed out
            await expect(await opsFundContract.allowanceOf(shop1.address)).to.equal(ethers.constants.MaxUint256);

            return {managerContract, opsFundContract, shop1, customer1};
        }

        let theSetup;

        beforeEach(async function () {
            theSetup = await loadFixture(setup);
        });

        it("Adds allowance on register", async function () {
            const {managerContract, opsFundContract, shop1, customer1} = theSetup;

            // Register for customer1 (should add allowance)
            await managerContract.connect(shop1).register(customer1.address, "SN-1", "URI");

            // Check new ops allowance of customer1
            const allowance = await opsFundContract.allowanceOf(customer1.address);
            await expect(allowance).to.equal(await opsFundContract.defaultAllowanceIncrement());
        });

        it("Adds allowance on transfer from a carte blanche holder", async function () {
            const {managerContract, opsFundContract, shop1, customer1} = theSetup;

            // Register for shop1 first
            await managerContract.connect(shop1).register(shop1.address, "SN-1", "URI");

            // Transfer to customer1 (should add allowance)
            await managerContract.connect(shop1).transfer("SN-1", customer1.address);

            // Check new ops allowance of customer1
            const allowance = await opsFundContract.allowanceOf(customer1.address);
            await expect(allowance).to.equal(await opsFundContract.defaultAllowanceIncrement());
        });

    });
});
