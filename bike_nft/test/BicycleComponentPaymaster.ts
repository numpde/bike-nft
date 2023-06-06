import hre, {ethers} from "hardhat";
import {expect} from "chai";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";

import {getSigners} from "./signers";
import {deployAllAndUI, deployOpsFundFixture} from "./fixtures";

import {GsnTestEnvironment} from '@opengsn/cli/dist/GsnTestEnvironment'
import {JsonRpcProvider, parseEther, ZeroAddress} from "ethers-v6";
import {RelayProvider} from "@opengsn/provider";

async function deployPaymasterFixture(): Promise<any> {
    const {deployer} = await getSigners();

    const {managerUI, ...etc} = await loadFixture(deployAllAndUI);

    const {opsFundContract} = await loadFixture(deployOpsFundFixture);

    const Contract = await ethers.getContractFactory("BicycleComponentPaymaster");
    const paymasterContract = await Contract.connect(deployer).deploy();

    await opsFundContract.connect(deployer).grantRole(opsFundContract.PAYMASTER_ROLE(), paymasterContract.address);
    await paymasterContract.connect(deployer).setOpsFundContract(opsFundContract.address);

    const fragment = managerUI.interface.getFunction("register");
    const sighash = managerUI.interface.getSighash(fragment);
    await paymasterContract.connect(deployer).whitelistMethod(managerUI.address, sighash, true);

    // HOW TO:
    // npx hardhat node --port 8484
    // npx hardhat --network localhost test test/BicycleComponentPaymaster.ts
    const url = hre.network.config['url'];

    const provider = new JsonRpcProvider(url);
    const gsnSettings = await GsnTestEnvironment.startGsn(url);

    await paymasterContract.connect(deployer).setRelayHub(gsnSettings.contractsDeployment?.relayHubAddress);
    await paymasterContract.connect(deployer).setTrustedForwarder(gsnSettings.contractsDeployment?.forwarderAddress);

    await managerUI.connect(deployer).setTrustedForwarder(gsnSettings.contractsDeployment?.forwarderAddress);

    await deployer.sendTransaction({to: paymasterContract.address, value: parseEther("1")});

    return {provider, gsnSettings, paymasterContract, opsFundContract, managerUI, ...etc};
}

describe("Fixture", function () {
    describe("GsnTestEnvironment", function () {
        it("Should deploy GsnTestEnvironment", async function () {
            const {gsnSettings, provider} = await loadFixture(deployPaymasterFixture);

            await expect(await provider.getCode(gsnSettings.contractsDeployment?.relayHubAddress)).to.not.equal("0x");
            await expect(await provider.getCode(gsnSettings.contractsDeployment?.forwarderAddress)).to.not.equal("0x");
        });
    });

    describe("Paymaster", function () {
        it("Should deploy the paymaster", async function () {
            const {paymasterContract} = await loadFixture(deployPaymasterFixture);
            await expect(paymasterContract).to.exist;
        });

        it("Should set paymaster's opsFundContract", async function () {
            const {opsFundContract, paymasterContract} = await loadFixture(deployPaymasterFixture);
            await expect(await paymasterContract.opsFundContract()).to.equal(opsFundContract.address);
        });

    });
});

describe("BicycleComponentPaymaster", function () {
    it("...", async function () {
        const {_, deployer, third} = await getSigners();
        const {paymasterContract, managerUI, provider} = await loadFixture(deployPaymasterFixture);

        const config = {
            paymasterAddress: paymasterContract.address,
            performDryRunViewRelayCall: false,
            loggerConfiguration: {logLevel: 'error',},
        }

        const {gsnProvider, gsnSigner} =
            await RelayProvider.newEthersV5Provider({provider: deployer, config} as any);

        await expect(await gsnSigner.getAddress()).to.equal(await deployer.getAddress());

        const balanceBefore = await deployer.getBalance();

        await managerUI.connect(gsnSigner).register(
            third.address,
            "SN-12341234",
            "Bicycle", "Good bicycle", "https://example.com/bicycle.png",
        );

        const balanceAfter = await deployer.getBalance();

        console.log("Balance before: ", balanceBefore);
        console.log("Balance after:  ", balanceAfter);
    });

});
