import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";

import {getSigners} from "./signers";
import {deployAllAndUI} from "./fixtures";


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
            await expect(action).to.be.revertedWith("BCM: Insufficient rights");
        });
    });

    describe("Registration", function () {
        it("Should not allow a UI admin to register for another", async function () {
            const {customer1: uiAdmin, third} = await getSigners();
            const {managerUI, managerContract} = await loadFixture(deployAllAndUI);

            const serialNumber = "SN-123";

            const action0 = managerUI.grantRole(managerUI.DEFAULT_ADMIN_ROLE(), uiAdmin.address);
            await expect(action0).not.to.be.reverted;

            // `admin` is admin on the UI but has no registrar role on the manager contract
            await expect(managerContract.hasRole(managerContract.REGISTRAR_ROLE(), uiAdmin.address)).to.eventually.equal(false);
            await expect(managerContract.hasRole(managerContract.DEFAULT_ADMIN_ROLE(), uiAdmin.address)).to.eventually.equal(false);

            // `admin` interacts with the UI contract directly
            const action1 = managerUI.connect(uiAdmin).register(
                third.address,  // registerFor
                serialNumber,
                "My bike",
                "It's a decent bike",
                "https://ids.si.edu/ids/deliveryService?max=170&id=NPM-1993_2070_19",
            );

            await expect(action1).to.be.reverted;
        });

        it("Should not allow a generic account to register", async function () {
            const {deployer, third} = await getSigners();
            const {managerUI} = await loadFixture(deployAllAndUI);

            const action = managerUI.connect(third).register(
                third.address,  // registerFor
                "SN-123",
                "My bike",
                "It's a decent bike",
                "https://ids.si.edu/ids/deliveryService?max=170&id=NPM-1993_2070_19",
            );

            await expect(action).to.be.reverted;
        });

        it("Should allow a new registrar to register", async function () {
            const {deployer, third} = await getSigners();
            const {managerUI, managerContract} = await loadFixture(deployAllAndUI);

            const action1 = managerContract.connect(deployer).grantRole(managerContract.REGISTRAR_ROLE(), third.address);
            await expect(action1).not.to.be.reverted;

            const action = managerUI.connect(third).register(third.address, "SN-123", "", "", "");
            await expect(action).not.to.be.reverted;
        });
    });

    describe("Transfer", function () {
        it("Allows a component owner to transfer their component", async function () {
            const {shop1, customer1, customer2} = await getSigners();
            const {managerUI} = await loadFixture(deployAllAndUI);

            const serialNumber = "SN-123";

            // Register a component for `customer1`
            const action1 = managerUI.connect(shop1).register(customer1.address, serialNumber, "", "", "");
            await expect(action1).not.to.be.reverted;

            // customer2 -> customer1 fails
            const action2a = managerUI.connect(customer2).transfer(serialNumber, customer1.address);
            await expect(action2a).to.be.reverted;

            // customer1 -> customer2 succeeds
            const action1a = managerUI.connect(customer1).transfer(serialNumber, customer2.address);
            await expect(action1a).not.to.be.reverted;

            // customer2 -> customer1 succeeds now
            const action2b = managerUI.connect(customer2).transfer(serialNumber, customer1.address);
            await expect(action2b).not.to.be.reverted;
        });

        it("Allows the shop to transfer their 'minted' component", async function () {
            const {shop1, customer1, customer2} = await getSigners();
            const {managerUI} = await loadFixture(deployAllAndUI);

            const serialNumber = "SN-123";

            // Register a component for `customer1`
            const action1 = managerUI.connect(shop1).register(customer1.address, serialNumber, "", "", "");
            await expect(action1).not.to.be.reverted;

            // shop transfers customer1 -> customer2
            const action2 = managerUI.connect(shop1).transfer(serialNumber, customer2.address);
            await expect(action2).not.to.be.reverted;
        });

        it("Disallows other shop to transfer", async function () {
            const {shop1, shop2, customer1, customer2} = await getSigners();
            const {managerUI, managerContract} = await loadFixture(deployAllAndUI);

            const serialNumber = "SN-123";

            // Register a component for `customer1`
            const action1 = managerUI.connect(shop1).register(customer1.address, serialNumber, "", "", "");
            await expect(action1).not.to.be.reverted;

            // check that shop2 has the registrar role
            await expect(managerContract.hasRole(managerContract.REGISTRAR_ROLE(), shop2.address)).to.eventually.equal(true);

            // shop2 attempts to transfer customer1 -> customer2
            const action2 = managerUI.connect(shop2).transfer(serialNumber, customer2.address);
            await expect(action2).to.be.revertedWith("BCM: Insufficient rights");
        });
    });
});
