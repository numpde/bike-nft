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
import {silentLogger} from "../utils/utils";


async function deployPaymasterFixture(): Promise<any> {
    const {deployer, shop1} = await getSigners();

    const etc = await loadFixture(deployAllAndUI);
    const {managerContract, managerUI} = etc;

    const {opsFundContract} = await loadFixture(deployOpsFundFixture);

    const Contract = await ethers.getContractFactory("BicycleComponentPaymaster");
    const paymasterContract = await Contract.connect(deployer).deploy();

    await opsFundContract.connect(deployer).grantRole(opsFundContract.PAYMASTER_ROLE(), paymasterContract.address);
    await paymasterContract.connect(deployer).setOpsFundContract(opsFundContract.address);

    const whitelist = async (methodName: string) => {
        const fragment = managerUI.interface.getFunction(methodName);
        const sighash = managerUI.interface.getSighash(fragment);
        await paymasterContract.connect(deployer).whitelistMethod(managerUI.address, sighash, true);
    };

    await whitelist("register");
    await whitelist("transfer");

    // HOW TO:
    // npx hardhat node --port 8484
    // npx hardhat --network localhost test test/BicycleComponentPaymaster.ts
    const url = hre.network.config['url'];

    const provider = new JsonRpcProvider(url);
    const gsnSettings: TestEnvironment = await GsnTestEnvironment.startGsn(url, "http://localhost", 12345, silentLogger, true);

    await paymasterContract.connect(deployer).setRelayHub(gsnSettings.contractsDeployment?.relayHubAddress || "");
    await paymasterContract.connect(deployer).setTrustedForwarder(gsnSettings.contractsDeployment?.forwarderAddress || "");

    await managerUI.connect(deployer).setTrustedForwarder(gsnSettings.contractsDeployment?.forwarderAddress);

    // Ops token management and funds
    await managerContract.setOpsFundContractAddress(opsFundContract.address);
    await opsFundContract.grantRole(await opsFundContract.OPS_MANAGER_ROLE(), managerContract.address);
    await opsFundContract.grantRole(await opsFundContract.CARTE_BLANCHE_ROLE(), shop1.address);

    // Fund the relay
    await deployer.sendTransaction({to: paymasterContract.address, value: parseEther("1")});

    return {provider, gsnSettings, paymasterContract, opsFundContract,  ...etc};
}

describe("BicycleComponentPaymaster", function () {
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

    describe("Gasless transactions", function () {

        let theSetup;
        let snapshotId;

        before(async function () {
            const things = await loadFixture(deployPaymasterFixture);
            const {paymasterContract} = things;

            const relayProviderInput: {
                provider: any;
                config: Partial<GSNConfig>;
                overrideDependencies: Partial<GSNDependencies>;
            } = {
                provider: null,
                config: {
                    paymasterAddress: paymasterContract.address,
                    performDryRunViewRelayCall: false,
                    maxRelayNonceGap: 5,
                },
                overrideDependencies: {logger: silentLogger},
            };

            // console.log("Trusted forwarder: ", await things.managerUI.getTrustedForwarder());
            // console.log("Trusted forwarder: ", await things.paymasterContract.getTrustedForwarder());
            // console.log("Trusted forwarder: ", await things.gsnSettings.contractsDeployment?.forwarderAddress);

            theSetup = {relayProviderInput, ...things};
            snapshotId = await ethers.provider.send('evm_snapshot', []);
        });

        afterEach(async function () {
            snapshotId = await ethers.provider.send('evm_snapshot', []);
        });

        beforeEach(async function () {
            if (snapshotId) {
                await ethers.provider.send('evm_revert', [snapshotId]);
            }
        });

        it("Performs a gasless call to the UI contract", async function () {
            const {deployer} = await getSigners();
            const {
                paymasterContract,
                managerUI,
                provider,
                gsnSettings,
                relayProviderInput
            } = theSetup;

            const {gsnSigner: gsnDeployer} =
                await RelayProvider.newEthersV5Provider({...relayProviderInput, provider: deployer});

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
                deployer.address,
                "SN-123",
                "Bicycle", "Good bicycle", "https://example.com/bicycle.png",
            );

            // console.log("Response:", txResponse);

            await txResponse.wait();

            // console.log("Receipt:", txReceipt);

            for (const who of Object.keys(addressBalances)) {
                addressBalances[who].after = await provider.getBalance(addressBalances[who].address);
                balancesAtRelayHub[who].after = await relayHub.balanceOf(addressBalances[who].address);

                // console.log(who, addressBalances[who].address);
                // console.log("Balance before (ETH):", BigInt(addressBalances[who].before));
                // console.log("Balance after  (ETH):", BigInt(addressBalances[who].after), "delta:", BigInt(addressBalances[who].after) - BigInt(addressBalances[who].before));
                //
                // console.log("Balance before (@RH):", BigInt(balancesAtRelayHub[who].before));
                // console.log("Balance after  (@RH):", BigInt(balancesAtRelayHub[who].after), "delta:", BigInt(balancesAtRelayHub[who].after) - BigInt(balancesAtRelayHub[who].before));
            }

            // await expect(deployerBalanceAfter).to.be.equal(deployerBalanceBefore);
        });

        it("Disallows a gasless call to the UI contract in general", async function () {
            const {third} = await getSigners();
            const {managerUI, relayProviderInput} = theSetup;

            const {gsnSigner: gsnThird} =
                await RelayProvider.newEthersV5Provider({...relayProviderInput, provider: third});

            await expect(await gsnThird.getAddress()).to.equal(await third.getAddress());

            const tx = managerUI.connect(gsnThird).register(third.address, "SN-007", "X", "Y", "Z");

            await expect(tx).to.be.revertedWith("BCM: Insufficient rights");
        });

        it("Metacheck: The blockchain state is not rolled back between gasless calls", async function () {
            const {managerContract} = theSetup;
            await expect(await managerContract.ownerOf("SN-123")).to.not.equal(ZeroAddress);
        });

        it("Allows a gasless `register` call for ops tokens", async function () {
            const {shop2} = await getSigners();
            const {managerContract, managerUI, opsFundContract, relayProviderInput} = theSetup;

            const {gsnSigner: gsnShop2} =
                await RelayProvider.newEthersV5Provider({...relayProviderInput, provider: shop2});

            // Check that `shop2` is a registrar.
            await expect(await managerContract.hasRole(await managerContract.REGISTRAR_ROLE(), shop2.address)).to.be.true;

            // Initially, `shop2` does not have the ops tokens to `register`.
            await expect(await opsFundContract.allowanceOf(shop2.address)).to.equal(0);
            // ... let's give those.
            await opsFundContract.addAllowance(shop2.address, 1);
            await expect(await opsFundContract.allowanceOf(shop2.address)).to.equal(1);

            const tx = managerUI.connect(gsnShop2).register(shop2.address, "SN-321", "X", "Y", "Z");
            await expect(() => tx).to.changeEtherBalances([shop2, managerUI], [0, 0]);

            await expect(await managerContract.ownerOf("SN-321")).to.equal(shop2.address);
            await expect(await opsFundContract.allowanceOf(shop2.address)).to.equal(0);
        });

        it("Auto-mints ops tokens on `register` [pre-gasless]", async function () {
            const {shop1, third} = await getSigners();
            const {managerContract, opsFundContract} = theSetup;

            // `third` has no ops tokens initially
            await expect(await opsFundContract.allowanceOf(third.address)).to.equal(0);

            // register a thing `shop1` -> `third`, auto-mint ops tokens
            await managerContract.connect(shop1).register(third.address, "SN-1234", "URI");

            // `third` has some ops tokens now
            await expect(await opsFundContract.allowanceOf(third.address)).to.equal(await opsFundContract.defaultAllowanceIncrement());
        });

        it("Allows a gasless `transfer` in exchange for ops tokens", async function () {
            const {third, shop2} = await getSigners();
            const {managerUI, opsFundContract, relayProviderInput} = theSetup;

            // `third` has some ops tokens from the previous test
            const initialOpsTokens = await opsFundContract.allowanceOf(third.address);
            await expect(initialOpsTokens).to.not.equal(0);

            // // third -> managerUI doesn't fail because `third` can pay in ether:
            // const tx0 = await managerUI.connect(third).transfer("SN-1234", shop2.address);
            // await expect(tx0).to.be.revertedWith("?");

            // construct the relay client
            const {gsnSigner: gsnThird} =
                await RelayProvider.newEthersV5Provider({...relayProviderInput, provider: third});

            // third -> relay -> managerUI
            const tx = await managerUI.connect(gsnThird).transfer("SN-1234", shop2.address);
            await expect(() => tx).to.changeEtherBalances([third], [0]);

            // `third` has fewer ops tokens now
            const finalOpsTokens = await opsFundContract.allowanceOf(third.address);
            await expect(finalOpsTokens).to.equal(initialOpsTokens - 1);
        });
    });
});
