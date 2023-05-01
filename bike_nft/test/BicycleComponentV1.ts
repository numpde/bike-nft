import {time, loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {anyValue} from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import {expect} from "chai";
import {ethers} from "hardhat";

describe("BicycleComponentV1", function () {
    async function deployBicycleComponentFixture() {
        const [owner, other] = await ethers.getSigners();

        const BicycleComponentV1 = await ethers.getContractFactory("BicycleComponentV1");

        // https://dev.to/abhikbanerjee99/testing-your-upgradeable-smart-contract-2fjd
        const bicycleComponentV1 = await upgrades.deployProxy(BicycleComponentV1, [], {
            initializer: 'initialize',
            kind: 'transparent',
            value: 0
        });

        return {bicycleComponentV1, owner, other};
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
            async function register() {
                const {bicycleComponentV1, owner, other} = await loadFixture(deployBicycleComponentFixture);

                const serialNumber = "SN12345678";
                const uri = "https://example.com/" + serialNumber;

                await bicycleComponentV1.register(other.address, serialNumber, uri);

                return {bicycleComponentV1, owner, other, serialNumber, uri};
            }

            it("Should assign initial ownership correctly", async function () {
                const {bicycleComponentV1, owner, other, serialNumber, uri} = await loadFixture(register);

                const tokenId = await bicycleComponentV1.generateTokenId(serialNumber);
                const ownerOf = await bicycleComponentV1.ownerOf(tokenId);

                expect(ownerOf).to.equal(other.address);
            });
        });
    });
});
