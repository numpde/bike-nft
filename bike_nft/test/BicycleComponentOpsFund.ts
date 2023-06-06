import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";

import {getSigners} from "./signers";
import {deployOpsFundFixture} from "./fixtures";


describe("BicycleComponentOpsFund", function () {
    describe("Deployment", function () {
        it("Should deploy", async function () {
            const {opsFundContract} = await loadFixture(deployOpsFundFixture);
            await expect(opsFundContract).to.exist;
        });
    });

    describe("Access Control", function () {
        it("Should allow DEFAULT_ADMIN_ROLE to change defaultAllowanceIncrement", async function () {
            const {admin} = await getSigners();
            const {opsFundContract} = await loadFixture(deployOpsFundFixture);

            const newDefaultAllowanceIncrement = 31;

            await expect(
                opsFundContract.connect(admin).setDefaultAllowanceIncrement(newDefaultAllowanceIncrement)
            ).not.to.be.reverted;

            await expect(
                opsFundContract.connect(admin).defaultAllowanceIncrement()
            ).to.eventually.equal(
                newDefaultAllowanceIncrement
            );
        });

        it("Should not allow a non-admin to change defaultAllowanceIncrement", async function () {
            const {admin, manager} = await getSigners();
            const {opsFundContract} = await loadFixture(deployOpsFundFixture);

            await expect(
                opsFundContract.hasRole(opsFundContract.OPS_MANAGER_ROLE(), manager.address)
            ).to.eventually.be.true;

            await expect(
                opsFundContract.connect(manager).setDefaultAllowanceIncrement(0)
            ).to.be.reverted;
        });

        it("Should allow OPS_MANAGER_ROLE to add allowance", async function () {
            const {manager, third} = await getSigners();
            const {opsFundContract} = await loadFixture(deployOpsFundFixture);

            const allowanceToAdd = 5;

            await expect(
                opsFundContract.connect(manager).addAllowance(third.address, allowanceToAdd)
            ).not.to.be.reverted;

            await expect(
                opsFundContract.allowanceOf(third.address)
            ).to.eventually.equal(
                allowanceToAdd
            );
        });

        it("Should not allow a non-OPS_MANAGER_ROLE to add allowance", async function () {
            const {admin, third} = await getSigners();
            const {opsFundContract} = await loadFixture(deployOpsFundFixture);

            await expect(
                opsFundContract.hasRole(opsFundContract.DEFAULT_ADMIN_ROLE(), admin.address)
            ).to.eventually.be.true;

            await expect(
                opsFundContract.connect(admin).addAllowance(third.address, 0)
            ).to.be.reverted;
        });

        it("Should allow PAYMASTER_ROLE to consume allowance", async function () {
            const {manager, paymaster, third} = await getSigners();
            const {opsFundContract} = await loadFixture(deployOpsFundFixture);

            await expect(
                opsFundContract.connect(manager).addAllowance(third.address, 2)
            ).not.to.be.reverted;

            await expect(
                opsFundContract.connect(paymaster).consume(third.address, 1)
            ).to.not.be.reverted;

            await expect(
                opsFundContract.allowanceOf(third.address)
            ).to.eventually.equal(1);
        });

        it("Should not allow a non-PAYMASTER_ROLE to consume allowance", async function () {
            const {manager, third} = await getSigners();
            const {opsFundContract} = await loadFixture(deployOpsFundFixture);

            await expect(
                opsFundContract.hasRole(opsFundContract.OPS_MANAGER_ROLE(), manager.address)
            ).to.eventually.be.true;

            await expect(
                opsFundContract.connect(manager).addAllowance(third.address, 2)
            ).not.to.be.reverted;

            await expect(
                opsFundContract.connect(manager).consume(third.address, 1)
            ).to.be.reverted;
        });

        it("Should allow CARTE_BLANCHE_ROLE to consume allowance without reducing balance", async function () {
            const {paymaster, shop1} = await getSigners();
            const {opsFundContract} = await loadFixture(deployOpsFundFixture);

            const initialAllowance = await opsFundContract.allowanceOf(shop1.address);

            await expect(
                opsFundContract.connect(paymaster).consume(shop1.address, 1)
            ).to.not.be.reverted;

            await expect(
                opsFundContract.allowanceOf(shop1.address)
            ).to.eventually.equal(initialAllowance);
        });
    });

    describe("Allowance", function () {
        it("Should correctly increment allowance after `addAllowance`", async function () {
            const {manager, third} = await getSigners();
            const {opsFundContract} = await loadFixture(deployOpsFundFixture);

            const initialAllowance = await opsFundContract.allowanceOf(third.address);

            const allowanceToAdd = 5;

            await expect(
                opsFundContract.connect(manager).addAllowance(third.address, allowanceToAdd)
            ).not.to.be.reverted;

            const finalAllowance = await opsFundContract.allowanceOf(third.address);
            await expect(finalAllowance).to.equal(initialAllowance.add(allowanceToAdd));
        });

        it("Should correctly decrement allowance after `consume`", async function () {
            const {manager, paymaster, third} = await getSigners();
            const {opsFundContract} = await loadFixture(deployOpsFundFixture);

            await expect(
                opsFundContract.connect(manager).addAllowance(third.address, 5)
            ).not.to.be.reverted;

            const initialAllowance = await opsFundContract.allowanceOf(third.address);

            await expect(
                opsFundContract.connect(paymaster).consume(third.address, 3)
            ).not.to.be.reverted;

            const finalAllowance = await opsFundContract.allowanceOf(third.address);
            await expect(finalAllowance).to.equal(initialAllowance.sub(3));
        });

        it("Should not decrement allowance for CARTE_BLANCHE_ROLE after `consume`", async function () {
            const {paymaster, shop1} = await getSigners();
            const {opsFundContract} = await loadFixture(deployOpsFundFixture);

            const initialAllowance = await opsFundContract.allowanceOf(shop1.address);

            const allowanceToConsume = 2;

            await expect(
                opsFundContract.connect(paymaster).consume(shop1.address, allowanceToConsume)
            ).not.to.be.reverted;

            const finalAllowance = await opsFundContract.allowanceOf(shop1.address);
            await expect(finalAllowance).to.equal(initialAllowance);
        });
    });

    describe("Events", function () {
        it("Should emit DefaultAllowanceIncrementSet event on `setDefaultAllowanceIncrement`", async function () {
            const {admin} = await getSigners();
            const {opsFundContract} = await loadFixture(deployOpsFundFixture);

            const newDefaultAllowanceIncrement = 7;

            await expect(opsFundContract.connect(admin).setDefaultAllowanceIncrement(newDefaultAllowanceIncrement))
                .to.emit(opsFundContract, "DefaultAllowanceIncrementSet")
                .withArgs(newDefaultAllowanceIncrement);
        });

        it("Should emit AllowanceAdded event on `addAllowance`", async function () {
            const {manager, shop1} = await getSigners();
            const {opsFundContract} = await loadFixture(deployOpsFundFixture);

            const allowanceToAdd = 10;

            await expect(opsFundContract.connect(manager).addAllowance(shop1.address, allowanceToAdd))
                .to.emit(opsFundContract, "AllowanceAdded")
                .withArgs(shop1.address, allowanceToAdd);
        });

        it("Should emit AllowanceConsumed event on `consume` for CARTE_BLANCHE_ROLE", async function () {
            const {paymaster, shop1} = await getSigners();
            const {opsFundContract} = await loadFixture(deployOpsFundFixture);

            const allowanceToConsume = 2;

            const tx = await opsFundContract.connect(paymaster).consume(shop1.address, allowanceToConsume);

            await expect(tx)
                .to.not.emit(opsFundContract, "AllowanceAdded");

            await expect(tx)
                .to.emit(opsFundContract, "AllowanceConsumed")
                .withArgs(shop1.address, allowanceToConsume);
        });

        it("Should emit AllowanceConsumed event on `consume` for non-CARTE_BLANCHE_ROLE", async function () {
            const {manager, paymaster, third} = await getSigners();
            const {opsFundContract} = await loadFixture(deployOpsFundFixture);

            const allowanceToConsume = 2;

            // Ensure that the user has enough allowance
            await opsFundContract.connect(manager).addAllowance(third.address, allowanceToConsume);

            await expect(opsFundContract.connect(paymaster).consume(third.address, allowanceToConsume))
                .to.emit(opsFundContract, "AllowanceConsumed")
                .withArgs(third.address, allowanceToConsume);
        });

    });

});
