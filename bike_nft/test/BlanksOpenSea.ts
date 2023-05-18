import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {ethers, upgrades} from "hardhat";
import {expect} from "chai";

import {getSigners} from "./signers";
import {deployBicycleComponentManagerFixture} from "./BicycleComponentManager";
import {packJSON} from "../utils/utils";


async function deployBlanksFixture() {
    const {deployer, admin} = await getSigners();

    const Blanks = await ethers.getContractFactory("BlanksOpenSea");

    const blanks = await upgrades.deployProxy(
        Blanks.connect(deployer),
        [],
        {
            initializer: 'initialize',
            kind: 'uups',
            value: 0,
        }
    );

    const DEFAULT_ADMIN_ROLE = await blanks.DEFAULT_ADMIN_ROLE();

    // Check that the deployer has the admin role
    await expect(await blanks.connect(deployer).hasRole(DEFAULT_ADMIN_ROLE, deployer.address)).to.be.true;

    // Grant the admin role to the admin
    await blanks.connect(deployer).grantRole(DEFAULT_ADMIN_ROLE, admin.address);

    return {blanks};
}

async function deployAllAndLinkFixture() {
    const {componentsContract, managerContract} = await loadFixture(deployBicycleComponentManagerFixture);

    const {blanks} = await loadFixture(deployBlanksFixture);
    const {deployer} = await getSigners();

    // link
    await blanks.connect(deployer).setBicycleComponentManager(managerContract.address);
    await managerContract.connect(deployer).grantRole(managerContract.REGISTRAR_ROLE(), blanks.address);

    return {blanks, componentsContract, managerContract};
}

describe("Blanks", function () {
    describe("Deployment", function () {
        it("Should deploy the contract", async function () {
            const {blanks} = await loadFixture(deployBlanksFixture);
            await expect(blanks).to.exist;
        });

        it("Should initialize with minted tokens", async function () {
            const {blanks} = await loadFixture(deployBlanksFixture);
            const {deployer} = await getSigners();

            const balance = await blanks.balanceOf(deployer.address, await blanks.BLANK_NFT_TOKEN_ID_B());
            await expect(balance).to.be.gt(0);
        });
    });

    describe("Minting", function () {
        it("Should allow minting by deployer", async function () {
            const {blanks} = await loadFixture(deployBlanksFixture);
            const {deployer, shop1} = await getSigners();

            const tokenId = blanks.BLANK_NFT_TOKEN_ID_D();
            const amount = 10;

            const action = blanks.connect(deployer).mint(shop1.address, tokenId, amount, "0x");
            await expect(action).not.to.be.reverted;
        });
    });

    describe("Transfer", function () {
        it("Should allow transfer of a non-privileged token", async function () {
            const {blanks} = await loadFixture(deployBlanksFixture);
            const {deployer, shop1, third} = await getSigners();

            const tokenId = blanks.BLANK_NFT_TOKEN_ID_D();
            const amount = 10;

            const action1 = blanks.connect(deployer).mint(shop1.address, tokenId, amount, "0x");
            await expect(action1).not.to.be.reverted;

            const action2 = blanks.connect(shop1).safeTransferFrom(shop1.address, third.address, tokenId, 1, "0x");
            await expect(action2).not.to.be.reverted;
        });

        it("Should not allow transfer of a privileged token, in general", async function () {
            const {blanks} = await loadFixture(deployBlanksFixture);
            const {deployer, shop1, third} = await getSigners();

            const privilegedTokenId = blanks.BLANK_NFT_TOKEN_ID_B();
            const amount = 10;

            // mint
            const action1 = blanks.connect(deployer).mint(shop1.address, privilegedTokenId, amount, "0x");
            await expect(action1).not.to.be.reverted;

            // shop fails to transfer to a third party
            const action2 = blanks.connect(shop1).safeTransferFrom(shop1.address, third.address, privilegedTokenId, 1, "0x");
            await expect(action2).to.be.revertedWith("Transfer of privileged token");

            // admin can transfer to a third party
            const action3 = blanks.connect(deployer).safeTransferFrom(shop1.address, third.address, privilegedTokenId, 1, "0x");
            await expect(action3).not.to.be.reverted;

            // shop can burn the token, though
            // (untested)

            // approve an operator for deployer's tokens
            const action5 = blanks.connect(deployer).setApprovalForAll(third.address, true);
            await expect(action5).not.to.be.reverted;

            // approved operator can transfer from deployer because deployer has the MINTER_ROLE
            const action6 = blanks.connect(third).safeTransferFrom(deployer.address, third.address, privilegedTokenId, 1, "0x");
            await expect(action6).not.to.be.reverted;

        });
    });

    describe("URI", function () {
        it("Should return the correct URI", async function () {
            const {blanks} = await loadFixture(deployAllAndLinkFixture);
            const {deployer, shop1} = await getSigners();

            const staticURI = "https://example.com/{1}";
            await blanks.connect(deployer).setURI(staticURI);

            const tokenId = 123;
            const action1 = blanks.connect(deployer).mint(shop1.address, tokenId, 1, "0x");
            await expect(action1).not.to.be.reverted;

            const oldURI = await blanks.uri(tokenId);
            await expect(oldURI).to.equal(staticURI);

            const customTokenURI = "https://special.com/metadata.json";
            const action2 = blanks.connect(deployer).setCustomTokenURI(tokenId, customTokenURI);
            await expect(action2).not.to.be.reverted;

            const newURI = await blanks.uri(tokenId);
            await expect(newURI).to.equal(customTokenURI);
        });
    });

    describe("Registration", function () {
        it("Should allow registration by the shop", async function () {
            const {blanks, managerContract, componentsContract} = await loadFixture(deployAllAndLinkFixture);
            const {deployer, shop1} = await getSigners();

            const serialNumber = "SN12345678";
            const amount = 10;

            // mint
            const blankTokenId = blanks.BLANK_NFT_TOKEN_ID_B();
            const action1 = blanks.connect(deployer).mint(shop1.address, blankTokenId, amount, "0x");
            await expect(action1).not.to.be.reverted;

            const metadata = {
                name: "My Bike",
                description: "My Bike Description",
                image: "https://example.com/image.png",

                // this part is regenerated by the Blanks contract
                attributes: [
                    {
                        trait_type: "Authority",
                        value: "B",
                    },
                ]
            }

            // register
            const action2 = blanks.connect(shop1).register(blankTokenId, serialNumber, metadata.name, metadata.description, metadata.image);
            await expect(action2).not.to.be.reverted;

            // component contract's token ID from the serial number
            const remoteTokenId = managerContract.generateTokenId(serialNumber);

            // the shop has the token in the components contract
            const remoteBalance = await componentsContract.connect(shop1).balanceOf(shop1.address, remoteTokenId);
            await expect(remoteBalance).to.equal(1);

            // the shop now has 9 blanks left
            const blankBalance = await blanks.balanceOf(shop1.address, blankTokenId);
            await expect(blankBalance).to.equal(amount - 1);

            // the remote URI
            const referenceURI = await packJSON(metadata);
            const candidateURI = await componentsContract.tokenURI(remoteTokenId);
            await expect(candidateURI).to.equal(referenceURI);
        });
    });

    describe("Payment on `register`", function () {
        it("Should forward and return the right amounts", async function () {
            const {blanks, managerContract} = await loadFixture(deployAllAndLinkFixture);
            const {deployer, third} = await getSigners();

            await managerContract.setMinAmountOnRegister(2);
            await managerContract.setMaxAmountOnRegister(4);

            // mint blanks
            const blankTokenId = blanks.BLANK_NFT_TOKEN_ID_D();
            const action0 = blanks.connect(deployer).mint(third.address, blankTokenId, 10, "0x");
            await expect(action0).not.to.be.reverted;

            // reverts
            const action1 = blanks.connect(third).register(blankTokenId, "SN1", "Bike1", "It's fine", "", {value: 1});
            await expect(action1).to.be.revertedWith("Insufficient payment");

            // keeps all the value
            const action2 = blanks.connect(third).register(blankTokenId, "SN2", "Bike2", "It's fine", "", {value: 2});
            await expect(action2).to.changeEtherBalances([third, blanks, managerContract], [-2, 0, 2]);

            // keeps all the value
            const action3 = blanks.connect(third).register(blankTokenId, "SN3", "Bike3", "It's fine", "", {value: 3});
            await expect(action3).to.changeEtherBalances([third, blanks, managerContract], [-3, 0, 3]);

            // keeps all the value
            const action4 = blanks.connect(third).register(blankTokenId, "SN4", "Bike4", "It's fine", "", {value: 4});
            await expect(action4).to.changeEtherBalances([third, blanks, managerContract], [-4, 0, 4]);

            // returns change
            const action5 = blanks.connect(third).register(blankTokenId, "SN5", "Bike5", "It's fine", "", {value: 5});
            await expect(action5).to.changeEtherBalances([third, blanks, managerContract], [-4, 0, 4]);
        });
    });
});
