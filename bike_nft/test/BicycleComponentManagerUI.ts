import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {ethers} from "hardhat";
import {expect} from "chai";

import {deploymentParams} from "../deploy.config";
import {getSigners} from "./signers";
import {deployAllAndLinkFixture} from "./fixtures";

async function deployAllAndUI() {
    const {deployer} = await getSigners();
    const {managerContract, ...etc} = await loadFixture(deployAllAndLinkFixture);

    const contractName = "BicycleComponentManagerUI";

    const ContractUI = await ethers.getContractFactory(contractName);

    const contractUI = await ContractUI.connect(deployer).deploy(
        managerContract.address,
        ethers.constants.AddressZero,  // Trusted forwarder
        deploymentParams.hardhat?.baseURI?.[contractName] || "",
    );

    await contractUI.deployed();

    // Link
    const tx = await managerContract.grantRole(managerContract.REGISTRAR_ROLE(), contractUI.address);
    const receipt = await tx.wait();

    return {managerContract, managerUI: contractUI, ...etc};
}

describe("BicycleComponentManagerUI", function () {
    describe("Deployment", function () {
        it("Should deploy", async function () {
            const {managerUI} = await loadFixture(deployAllAndUI);
            await expect(managerUI).to.exist;
        });

        it("Should...", async function () {

        });
    });

    describe("Trusted forwarder", function () {
        it("Allows the deployer to set the trusted forwarder", async function () {
            const {deployer, third} = await getSigners();
            const {managerUI} = await loadFixture(deployAllAndUI);

            const action = managerUI.connect(deployer).setTrustedForwarder(third.address);
            await expect(action).not.to.be.reverted;
        });

        it("Should not allow a non-deployer to set the trusted forwarder", async function () {
            const {deployer, third} = await getSigners();
            const {managerUI} = await loadFixture(deployAllAndUI);

            const action = managerUI.connect(third).setTrustedForwarder(third.address);
            await expect(action).to.be.reverted;
        });
    });

    describe("Address info", function () {
        it("Allows to update own address info", async function () {
            const {third} = await getSigners();
            const {managerUI} = await loadFixture(deployAllAndUI);

            const action = managerUI.connect(third).updateAddressInfo(third.address, "New address info");
            await expect(action).not.to.be.reverted;
        });

        it("Allows a registrar to update anyone's address info", async function () {
            const {deployer, shop1, third} = await getSigners();
            const {managerContract, managerUI} = await loadFixture(deployAllAndUI);

            // grant registrar role to `shop1`
            const action1 = managerContract.connect(deployer).grantRole(managerContract.REGISTRAR_ROLE(), shop1.address);
            await expect(action1).not.to.be.reverted;

            const action2 = managerUI.connect(shop1).updateAddressInfo(third.address, "New address info");
            await expect(action2).not.to.be.reverted;
        });

        it("Doesn't allow a non-registrar to update anyone's address info", async function () {
            const {shop1, third} = await getSigners();
            const {managerUI} = await loadFixture(deployAllAndUI);

            const action = managerUI.connect(third).updateAddressInfo(shop1.address, "New address info");
            await expect(action).to.be.revertedWith("BicycleComponentManagerUI: Insufficient rights");
        });
    });

    describe("Registration", function () {
        it("Should allow the deployer to register for another", async function () {
            const {deployer, third} = await getSigners();
            const {managerUI, managerContract} = await loadFixture(deployAllAndUI);

            const serialNumber = "SN-123";

            // `third` interacts with the UI contract directly
            const action1 = managerUI.connect(deployer).register(
                deployer.address,  // userAddress
                third.address,  // registerFor
                serialNumber,
                "My bike",
                "It's a decent bike",
                "https://ids.si.edu/ids/deliveryService?max=170&id=NPM-1993_2070_19",
            );

            await expect(action1).not.to.be.reverted;

            // check that `third` got a token
            const action2 = managerContract.ownerOf(serialNumber);
            await expect(action2).to.eventually.equal(third.address);
        });

        it("Should not allow a generic account to register", async function () {
            const {deployer, third} = await getSigners();
            const {managerUI} = await loadFixture(deployAllAndUI);

            const action = managerUI.connect(third).register(
                deployer.address,  // userAddress (masquerading as `deployer`)
                third.address,  // registerFor
                "SN-123",
                "My bike",
                "It's a decent bike",
                "https://ids.si.edu/ids/deliveryService?max=170&id=NPM-1993_2070_19",
            );

            await expect(action).to.be.reverted;
        });

        it("Should allow a new registrar to register", async function () {
            const {deployer, shop1, third} = await getSigners();
            const {managerUI, managerContract} = await loadFixture(deployAllAndUI);

            const action1 = managerContract.connect(deployer).grantRole(managerContract.REGISTRAR_ROLE(), shop1.address);
            await expect(action1).not.to.be.reverted;

            const action = managerUI.connect(shop1).register(
                shop1.address,  // userAddress (masquerading as `deployer`)
                third.address,  // registerFor
                "SN-123",
                "My bike",
                "It's a decent bike",
                "https://ids.si.edu/ids/deliveryService?max=170&id=NPM-1993_2070_19",
            );

            await expect(action).not.to.be.reverted;
        });

        it("Should not allow even a registrar to impersonate", async function () {
            const {deployer, shop1, third} = await getSigners();
            const {managerUI, managerContract} = await loadFixture(deployAllAndUI);

            const action1 = managerContract.connect(deployer).grantRole(managerContract.REGISTRAR_ROLE(), shop1.address);
            await expect(action1).not.to.be.reverted;

            const action = managerUI.connect(shop1).register(
                deployer.address,  // userAddress (masquerading as `deployer`)
                third.address,  // registerFor
                "SN-123",
                "My bike",
                "It's a decent bike",
                "https://ids.si.edu/ids/deliveryService?max=170&id=NPM-1993_2070_19",
            );

            const reason = "BicycleComponentManagerUI: userAddress and _msgSender don't match (or not a trusted forwarder)";
            await expect(action).to.be.revertedWith(reason);
        });
    });
});
