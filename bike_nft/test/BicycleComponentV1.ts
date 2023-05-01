import {time, loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {anyValue} from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import {expect} from "chai";
import {ethers} from "hardhat";

describe("BicycleComponentV1", function () {
    async function deployBicycleComponentFixture() {
        const [owner, other, third] = await ethers.getSigners();

        const BicycleComponentV1 = await ethers.getContractFactory("BicycleComponentV1");

        // https://dev.to/abhikbanerjee99/testing-your-upgradeable-smart-contract-2fjd
        const bicycleComponentV1 = await upgrades.deployProxy(BicycleComponentV1, [], {
            initializer: 'initialize',
            kind: 'transparent',
            value: 0
        });

        return {bicycleComponentV1, owner, other, third};
    }


    async function registerComponent() {
        const {bicycleComponentV1, owner: shop, other: customer, third: third} = await loadFixture(deployBicycleComponentFixture);

        const serialNumber = "SN12345678";
        const uri = "https://example.com/" + serialNumber;

        const tokenId = await bicycleComponentV1.generateTokenId(serialNumber);

        await bicycleComponentV1.register(customer.address, serialNumber, uri);

        // todo: check syntax
        return {bicycleComponentV1, shop, customer, third, serialNumber, uri, tokenId};
    }


    describe("Deployment", function () {
        it("Should deploy", async function () {
            const {bicycleComponentV1} = await loadFixture(deployBicycleComponentFixture);
            expect(bicycleComponentV1.address).to.not.be.null;
            expect(bicycleComponentV1.address).to.not.be.undefined;
            expect(bicycleComponentV1.address).to.not.be.empty;
        });

        it("Should grant initial roles to the deployer", async function () {
            const {bicycleComponentV1, owner} = await loadFixture(deployBicycleComponentFixture);

            const DEFAULT_ADMIN_ROLE = await bicycleComponentV1.DEFAULT_ADMIN_ROLE();
            const PAUSER_ROLE = await bicycleComponentV1.PAUSER_ROLE();
            const MINTER_ROLE = await bicycleComponentV1.MINTER_ROLE();

            const hasAdminRole = await bicycleComponentV1.hasRole(DEFAULT_ADMIN_ROLE, owner.address);
            const hasPauserRole = await bicycleComponentV1.hasRole(PAUSER_ROLE, owner.address);
            const hasMinterRole = await bicycleComponentV1.hasRole(MINTER_ROLE, owner.address);

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


        describe("Registration", function () {
            it("Should assign initial ownership correctly", async function () {
                const {bicycleComponentV1, customer, tokenId} = await loadFixture(registerComponent);

                const ownerOf = await bicycleComponentV1.ownerOf(tokenId);

                expect(ownerOf).to.equal(customer.address);
            });

            it("Should assign initial URI correctly", async function () {
                const {bicycleComponentV1, serialNumber, uri} = await loadFixture(registerComponent);

                const tokenId = await bicycleComponentV1.generateTokenId(serialNumber);
                const tokenURI = await bicycleComponentV1.tokenURI(tokenId);

                expect(tokenURI).to.equal(uri);
            });

            it("Should approve sender as operator for the newly minted token", async function () {
                const {bicycleComponentV1, shop, tokenId} = await loadFixture(registerComponent);

                const isApproved = await bicycleComponentV1.tokenOperatorApproval(tokenId, shop.address);

                expect(isApproved).to.be.true;
            });

            it("Should fail if the sender is not a minter", async function () {
                const {bicycleComponentV1, owner, other} = await loadFixture(deployBicycleComponentFixture);

                // TODO: Implement
            });

            it("Should emit a TokenOperatorApprovalUpdated for sender event", async function () {
                const {bicycleComponentV1, owner, other} = await loadFixture(deployBicycleComponentFixture);

                const serialNumber = "SN12345678";
                const uri = "https://example.com/" + serialNumber;

                const tokenId = await bicycleComponentV1.generateTokenId(serialNumber);

                await expect(bicycleComponentV1.register(other.address, serialNumber, uri))
                    .to.emit(bicycleComponentV1, "TokenOperatorApprovalUpdated")
                    .withArgs(tokenId, owner.address, true);
            });

            it("Should emit a ComponentRegistered for new owner event", async function () {
                const {bicycleComponentV1, owner, other} = await loadFixture(deployBicycleComponentFixture);

                const serialNumber = "SN12345678";
                const uri = "https://example.com/" + serialNumber;

                const tokenId = await bicycleComponentV1.generateTokenId(serialNumber);

                await expect(bicycleComponentV1.register(other.address, serialNumber, uri))
                    .to.emit(bicycleComponentV1, "ComponentRegistered")
                    .withArgs(other.address, tokenId, serialNumber, uri);
            });
        });

        describe("setTokenOperatorApproval", function () {
            it("Should set approval for a given operator and tokenId", async function () {
                const {bicycleComponentV1, tokenId, third} = await loadFixture(registerComponent);

                const isApprovedBefore = await bicycleComponentV1.tokenOperatorApproval(tokenId, third.address);

                await bicycleComponentV1.setTokenOperatorApproval(tokenId, third.address, true);

                const isApprovedAfter = await bicycleComponentV1.tokenOperatorApproval(tokenId, third.address);

                expect(isApprovedBefore).to.be.false;
                expect(isApprovedAfter).to.be.true;
            });

            it("Should emit TokenOperatorApprovalUpdated event when approval is granted", async function () {
                const {bicycleComponentV1, tokenId, third} = await loadFixture(registerComponent);

                await expect(bicycleComponentV1.setTokenOperatorApproval(tokenId, third.address, true))
                    .to.emit(bicycleComponentV1, "TokenOperatorApprovalUpdated")
                    .withArgs(tokenId, third.address, true);
            });

            it("Should emit TokenOperatorApprovalUpdated event when approval is revoked", async function () {
                const {bicycleComponentV1, tokenId, third} = await loadFixture(registerComponent);

                await expect(bicycleComponentV1.setTokenOperatorApproval(tokenId, third.address, false))
                    .to.emit(bicycleComponentV1, "TokenOperatorApprovalUpdated")
                    .withArgs(tokenId, third.address, false);
            });

            it("Should not allow setting approval for a non-existing token", async function () {
                const {bicycleComponentV1, third} = await loadFixture(registerComponent);

                const nonExistingTokenId = ethers.BigNumber.from("1");

                await expect(bicycleComponentV1.setTokenOperatorApproval(nonExistingTokenId, third.address, true))
                    .to.be.revertedWith("ERC721: invalid token ID");
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

            it("Should allow operator to transfer", async function () {
                const {bicycleComponentV1, customer, third, tokenId} = await loadFixture(registerComponent);

                // todo
                // await bicycleComponentV1.
            });

            it("Should disallow third party to transfer", async function () {
                // todo
            });

            it("Should revoke approval on transfer", async function () {
                // todo
            });

            it("Should grant approval on transfer", async function () {
                // todo
            });

            // todo: more
        });

    });
});
