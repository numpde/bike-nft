import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {ethers, upgrades} from "hardhat";
import {expect} from "chai";
import {getSigners} from "./signers";
import {deployBicycleComponentManagerFixture} from "./BicycleComponentManager";


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
    await managerContract.grantRole(managerContract.REGISTRAR_ROLE(), blanks.address);

    return {blanks, componentsContract, managerContract};
}

describe("Blanks", function () {
    describe("Deployment", function () {
        it("Should deploy the contract", async function () {
            const {blanks} = await loadFixture(deployBlanksFixture);
            await expect(blanks).to.exist;
        });
    });

    describe("Minting", function () {
        it("Should allow minting by deployer", async function () {
            const {blanks} = await loadFixture(deployBlanksFixture);
            const {deployer, shop1} = await getSigners();

            const tokenId = blanks.MY_BLANK_NFT_TOKEN_ID();
            const amount = 10;

            const action = blanks.connect(deployer).mint(shop1.address, tokenId, amount, "0x");
            await expect(action).not.to.be.reverted;
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
            const blankTokenId = blanks.MY_BLANK_NFT_TOKEN_ID();
            const action1 = blanks.connect(deployer).mint(shop1.address, blankTokenId, amount, "0x");
            await expect(action1).not.to.be.reverted;

            const metadata = {
                name: "My Bike",
                description: "My Bike Description",
                image: "https://example.com/image.png",
            }

            // register
            const action2 = blanks.connect(shop1).register(serialNumber, metadata.name, metadata.description, metadata.image);
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
            const referenceURI = "data:application/json;base64," + Buffer.from(JSON.stringify(metadata)).toString('base64');
            const candidateURI = await componentsContract.tokenURI(remoteTokenId);
            await expect(candidateURI).to.equal(referenceURI);
        });
    });

    describe("Payment on `register`", function () {
        it("Should forward and return the right amounts", async function () {
            const {blanks, managerContract} = await loadFixture(deployAllAndLinkFixture);
            const {deployer, shop1} = await getSigners();

            await managerContract.setMinAmountOnRegister(2);
            await managerContract.setMaxAmountOnRegister(4);

            // mint blanks
            const blankTokenId = blanks.MY_BLANK_NFT_TOKEN_ID();
            const action0 = blanks.connect(deployer).mint(shop1.address, blankTokenId, 10, "0x");
            await expect(action0).not.to.be.reverted;

            // reverts
            const action1 = blanks.connect(shop1).register("SN1", "Bike1", "It's fine", "", {value: 1});
            await expect(action1).to.be.revertedWith("Insufficient payment");

            // keeps all the value
            const action2 = blanks.connect(shop1).register("SN2", "Bike2", "It's fine", "", {value: 2});
            await expect(action2).to.changeEtherBalances([shop1, blanks, managerContract], [-2, 0, 2]);

            // keeps all the value
            const action3 = blanks.connect(shop1).register("SN3", "Bike3", "It's fine", "", {value: 3});
            await expect(action3).to.changeEtherBalances([shop1, blanks, managerContract], [-3, 0, 3]);

            // keeps all the value
            const action4 = blanks.connect(shop1).register("SN4", "Bike4", "It's fine", "", {value: 4});
            await expect(action4).to.changeEtherBalances([shop1, blanks, managerContract], [-4, 0, 4]);

            // returns change
            const action5 = blanks.connect(shop1).register("SN5", "Bike5", "It's fine", "", {value: 5});
            await expect(action5).to.changeEtherBalances([shop1, blanks, managerContract], [-4, 0, 4]);
        });
    });
});
