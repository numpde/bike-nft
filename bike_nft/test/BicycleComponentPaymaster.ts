import hre, {ethers} from "hardhat";
import {expect} from "chai";
import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";

import {getSigners} from "./signers";
import {deployAllAndUI, deployOpsFundFixture} from "./fixtures";

import {GsnTestEnvironment, TestEnvironment} from '@opengsn/cli/dist/GsnTestEnvironment'
import {JsonRpcProvider, parseEther, ZeroAddress} from "ethers-v6";
import {GSNConfig, RelayProvider} from "@opengsn/provider";
import {GSNDependencies} from "@opengsn/provider/dist/GSNConfigurator";
import {getAddress} from "ethers/lib/utils";

const silentLogger = {
    debug: () => {
    },
    info: () => {
    },
    warn: () => {
    },
    error: () => {
    },
};

const localRelayUrl = "http://localhost:12345";

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
    const gsnSettings: TestEnvironment = await GsnTestEnvironment.startGsn(url, "http://localhost", 12345, silentLogger, true);

    await paymasterContract.connect(deployer).setRelayHub(gsnSettings.contractsDeployment?.relayHubAddress || "");
    await paymasterContract.connect(deployer).setTrustedForwarder(gsnSettings.contractsDeployment?.forwarderAddress || "");

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
    it("Performs a gasless call to the UI contract", async function () {
        const {_, deployer, third} = await getSigners();
        const {paymasterContract, managerUI, provider, gsnSettings} = await loadFixture(deployPaymasterFixture);

        const config: Partial<GSNConfig> = {
            paymasterAddress: paymasterContract.address,
            performDryRunViewRelayCall: false,
            // loggerConfiguration: {logLevel: 'silent', loglevel: 'silent'},
        }

        const overrideDependencies: Partial<GSNDependencies> = {
            logger: silentLogger,
        };

        const {gsnSigner: gsnDeployer, gsnProvider} = await RelayProvider.newEthersV5Provider({
            provider: deployer,
            config,
            overrideDependencies
        } as any);

        await expect(await gsnDeployer.getAddress()).to.equal(await deployer.getAddress());

        const relayHub = await ethers.getContractAt("IRelayHub", gsnSettings.contractsDeployment?.relayHubAddress, gsnDeployer);

        const addressBalances = {
            deployer: {address: getAddress(deployer.address)},
            worker: {address: getAddress((gsnSettings as TestEnvironment).workerAddress || "")},
            manager: {address: getAddress((gsnSettings as TestEnvironment).managerAddress || "")},
            // relayhub: {address: getAddress(gsnSettings.contractsDeployment?.relayHubAddress)},
            paymaster: {address: getAddress(paymasterContract.address)},
        }

        const balancesAtRelayHub = {}

        for (const who of Object.keys(addressBalances)) {
            addressBalances[who].before = await provider.getBalance(addressBalances[who].address);
            balancesAtRelayHub[who] = {before: await relayHub.balanceOf(addressBalances[who].address)};
        }

        const txResponse = await managerUI.connect(gsnDeployer).register(
            third.address,
            "SN-12341234",
            "Bicycle", "Good bicycle", "https://example.com/bicycle.png",
        );

        console.log("Response:", txResponse);

        const txReceipt = await txResponse.wait();

        console.log("Receipt:", txReceipt);

        for (const who of Object.keys(addressBalances)) {
            addressBalances[who].after = await provider.getBalance(addressBalances[who].address);
            balancesAtRelayHub[who].after = await relayHub.balanceOf(addressBalances[who].address);

            console.log(who, addressBalances[who].address);
            console.log("Balance before (ETH):", BigInt(addressBalances[who].before));
            console.log("Balance after  (ETH):", BigInt(addressBalances[who].after), "delta:", BigInt(addressBalances[who].after) - BigInt(addressBalances[who].before));

            console.log("Balance before (@RH):", BigInt(balancesAtRelayHub[who].before));
            console.log("Balance after  (@RH):", BigInt(balancesAtRelayHub[who].after), "delta:", BigInt(balancesAtRelayHub[who].after) - BigInt(balancesAtRelayHub[who].before));
        }

        // await expect(deployerBalanceAfter).to.be.equal(deployerBalanceBefore);
    });

    it("waits...", async function () {
        await new Promise(resolve => setTimeout(resolve, 1000));
    });
});
