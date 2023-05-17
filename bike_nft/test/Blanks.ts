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
    const {deployer, shop1} = await getSigners();

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
            const amount = 1;
            const data = "0x";

            const action = blanks.connect(deployer).mint(shop1.address, tokenId, amount, data);
            await expect(action).not.to.be.reverted;
        });
    });

    describe("Registration", function () {
        it("Should allow registration by the shop", async function () {
            const {blanks, managerContract, componentsContract} = await loadFixture(deployAllAndLinkFixture);
            const {deployer, shop1} = await getSigners();

            const serialNumber = "1234567890";

            // mint
            const blankTokenId = blanks.MY_BLANK_NFT_TOKEN_ID();
            const action1 = blanks.connect(deployer).mint(shop1.address, blankTokenId, 10, "0x");
            await expect(action1).not.to.be.reverted;

            // register
            const action2 = blanks.connect(shop1).register(serialNumber, "My Bike", "My Bike Description", "https://example.com/image.png");
            await expect(action2).not.to.be.reverted;

            // get the tokenId from the serial number
            const remoteTokenId = managerContract.generateTokenId(serialNumber);

            // check that the shop has the token in the components contract
            const remoteBalance = await componentsContract.connect(shop1).balanceOf(shop1.address, remoteTokenId);
            await expect(remoteBalance).to.equal(1);

            // check that the shop now has 9 blanks left
            const blankBalance = await blanks.balanceOf(shop1.address, blankTokenId);
            await expect(blankBalance).to.equal(9);
        });
    });
});
