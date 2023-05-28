import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {ethers} from "hardhat";
import {expect} from "chai";

import {deploymentParams} from "../deploy.config";
import {getSigners} from "./signers";
import {deployAllAndLinkFixture} from "./fixtures";
import {Contract} from "ethers";

async function deployAllAndUI() {
    const {blanksContract, ...etc} = await loadFixture(deployAllAndLinkFixture);

    const BlanksUI = await ethers.getContractFactory("BlanksUI");

    const blanksUiContract = await BlanksUI.deploy(
        blanksContract.address,
        ethers.constants.AddressZero,
        deploymentParams.hardhat.baseURI.BlanksUI,
    );

    await blanksUiContract.deployed();

    // Link
    const tx = await blanksContract.grantRole(blanksContract.PROXY_ROLE(), blanksUiContract.address);
    const receipt = await tx.wait();

    return {blanksContract, blanksUiContract, ...etc};
}


function packForwarderData(contract: Contract, functionName: string, functionArgs: Array<any>, appendAddress: string) {
    const functionSig = contract.interface.getSighash(functionName);
    const functionFragment = contract.interface.getFunction(functionName);
    const types = functionFragment.inputs.map((input) => input.type);
    const encodedArgs = ethers.utils.defaultAbiCoder.encode(types, functionArgs);

    const data = functionSig + encodedArgs.slice(2) + (
        appendAddress ?
            ethers.utils.defaultAbiCoder.encode(["address"], [appendAddress]).slice(2) :
            ""
    );

    return data;
}

describe("BlanksUI", function () {
    describe("Deployment", function () {
        it("Should deploy", async function () {
            const {blanksUiContract} = await loadFixture(deployAllAndUI);
            await expect(blanksUiContract).to.exist;
        });

        it("Should...", async function () {

        });
    });

    describe("Registration", function () {
        it("Should allow an EOA to convert a blank", async function () {
            const {deployer, third} = await getSigners();
            const {blanksContract, blanksUiContract} = await loadFixture(deployAllAndUI);

            // mint blanks to `third`
            const blankTokenId = await blanksContract.BLANK_NFT_TOKEN_ID_D();
            const action0 = blanksContract.connect(deployer).mint(third.address, blankTokenId, 10, "0x");
            await expect(action0).not.to.be.reverted;

            // `third` interacts with the UI contract directly
            const action1 = blanksUiContract.connect(third).register(
                third.address,  // userAddress
                third.address,  // registerFor
                blankTokenId,
                "SN-123",
                "My bike",
                "It's a decent bike",
                "https://ids.si.edu/ids/deliveryService?max=170&id=NPM-1993_2070_19",
            );

            await expect(action1).not.to.be.reverted;
        });

        it("Should allow an EOA to convert a blank for another", async function () {
            const {deployer, shop1, customer1} = await getSigners();
            const {blanksContract, blanksUiContract, managerContract} = await loadFixture(deployAllAndUI);

            // mint blanks to `shop1`
            const blankTokenId = await blanksContract.BLANK_NFT_TOKEN_ID_D();
            const action0 = blanksContract.connect(deployer).mint(shop1.address, blankTokenId, 10, "0x");
            await expect(action0).not.to.be.reverted;

            const serialNumber = "SN-123";

            // `shop1` interacts with the UI contract directly
            const action1 = blanksUiContract.connect(shop1).register(
                shop1.address,  // userAddress
                customer1.address,  // registerFor
                blankTokenId,
                serialNumber,
                "My bike",
                "It's a decent bike",
                "https://ids.si.edu/ids/deliveryService?max=170&id=NPM-1993_2070_19",
            );

            await expect(action1).not.to.be.reverted;

            // now  `customer1` has an NFT
            const ownerOf = await managerContract.ownerOf(serialNumber);
            await expect(ownerOf).to.equal(customer1.address);
        });

        it("Should not allow an EOA to convert a blank they don't own", async function () {
            const {deployer, third} = await getSigners();
            const {blanksContract, blanksUiContract} = await loadFixture(deployAllAndUI);

            // mint blanks to `third`
            const blankTokenId = await blanksContract.BLANK_NFT_TOKEN_ID_D();
            const action0 = blanksContract.connect(deployer).mint(deployer.address, blankTokenId, 10, "0x");
            await expect(action0).not.to.be.reverted;

            // `third` interacts with the UI contract directly
            const action1 = blanksUiContract.connect(third).register(
                third.address,  // userAddress
                third.address,  // registerFor
                blankTokenId,
                "SN-123",
                "My bike",
                "It's a decent bike",
                "https://ids.si.edu/ids/deliveryService?max=170&id=NPM-1993_2070_19",
            );

            await expect(action1).to.be.revertedWith("BlanksOpenSea: blankTokenOwner has no such token");
        });

        it("Should allow a trusted forwarder to convert a blank on behalf of another", async function () {
            const {deployer, shop1, customer1, third} = await getSigners();
            const {blanksContract, blanksUiContract, managerContract} = await loadFixture(deployAllAndUI);

            // mint blanks to `shop1`
            const blankTokenId = await blanksContract.BLANK_NFT_TOKEN_ID_D();
            const action0 = blanksContract.connect(deployer).mint(shop1.address, blankTokenId, 10, "0x");
            await expect(action0).not.to.be.reverted;

            const serialNumber = "SN-123";

            const sendOnBehalfOf = shop1.address;
            const userAddress = shop1.address;
            const registerFor = customer1.address;

            const functionArgs = [
                userAddress,
                registerFor,
                blankTokenId,
                serialNumber,
                "My bike",
                "It's a decent bike",
                "https://ids.si.edu/ids/deliveryService?max=170&id=NPM-1993_2070_19",
            ]

            const data = packForwarderData(blanksUiContract, "register", functionArgs, sendOnBehalfOf);

            // `third` is not a trusted forwarder yet
            const action1 = third.sendTransaction({to: blanksUiContract.address, data: data, gasLimit: 1_000_000});
            await expect(action1).to.be.revertedWith("BlanksUI: userAddress and _msgSender don't match (or not a trusted forwarder)");

            // make `third` a trusted forwarder
            const action2 = blanksUiContract.connect(deployer).setTrustedForwarder(third.address);
            await expect(action2).not.to.be.reverted;

            // now it should work
            const action3 = third.sendTransaction({to: blanksUiContract.address, data: data, gasLimit: 1_000_000});
            await expect(action3).not.to.be.reverted;

            // and `customer1` has an NFT
            const ownerOf = await managerContract.ownerOf(serialNumber);
            await expect(ownerOf).to.equal(customer1.address);
        });
    });
});
