import {ethers} from "hardhat";
import {getAddress} from "ethers/lib/utils";

import {execute, getNetworkName} from "../utils/utils";
import {deploy} from "./utils";
import {deploymentParams} from "../deploy.config";
import {ZeroAddress} from "ethers-v6";


async function main() {
    const [deployer] = await ethers.getSigners();
    const chainId = await ethers.provider.getNetwork().then(network => network.chainId);

    // Get or deploy the managed components contract
    const {contract: opsFundContract} = await deploy({
        contractName: "BicycleComponentOpsFund",
        args: [],
        deployer,
        chainId,
    });

    // Then get or deploy the paymaster
    const {contract: paymasterContract} = await deploy({
        contractName: "BicycleComponentPaymaster",
        args: [],
        deployer,
        chainId,
    });

    console.log("Configure Paymaster...");
    {
        const trustedForwarder = deploymentParams[getNetworkName(chainId)]?.gsnTrustedForwarder || "";
        const relayHub = deploymentParams[getNetworkName(chainId)]?.gsnRelayHub || "";

        if (trustedForwarder && !(getAddress(trustedForwarder) == ZeroAddress)) {
            if (!(getAddress(await paymasterContract.getTrustedForwarder()) == getAddress(trustedForwarder))) {
                console.log(`Setting trusted forwarder to ${trustedForwarder}...`);
                await execute(await paymasterContract.setTrustedForwarder(trustedForwarder));
            } else {
                console.log("Trusted forwarder already set.");
            }
        } else {
            console.error(" (!) No trusted forwarder address found in deploymentParams.");
        }

        if (relayHub && !(getAddress(relayHub) == ZeroAddress)) {
            if (!(getAddress(await paymasterContract.getRelayHub()) == getAddress(relayHub))) {
                console.log("Setting relay hub...");
                await execute(await paymasterContract.setRelayHub(relayHub));
            } else {
                console.log("Relay hub already set.");
            }
        } else {
            console.error(" (!) No relay hub address found in deploymentParams.");
        }
    }

    console.log("Linking BicycleComponentOpsFund x BicycleComponentPaymaster...");
    {
        if (!(getAddress(await paymasterContract.opsFundContractAddress()) == getAddress(opsFundContract.address))) {
            console.log("Setting ops fund contract address...");
            await execute(await paymasterContract.setOpsFundContractAddress(opsFundContract.address));
        } else {
            console.log("Ops fund contract address already set.");
        }

        if (!(await opsFundContract.hasRole(await opsFundContract.PAYMASTER_ROLE(), paymasterContract.address))) {
            console.log("Granting paymaster role...");
            await execute(await opsFundContract.grantRole(await opsFundContract.PAYMASTER_ROLE(), paymasterContract.address));
        } else {
            console.log("Paymaster role already granted.");
        }
    }

    // Fetch the manager contract
    const {contract: managerContract} = await deploy({
        contractName: "BicycleComponentManager",
        chainId,
        onlyFetch: true,
    });

    console.log("Linking to BicycleComponentManager...");
    {
        if (!(await opsFundContract.hasRole(await opsFundContract.OPS_MANAGER_ROLE(), managerContract.address))) {
            console.log("Granting ops manager role...");
            await execute(await opsFundContract.grantRole(await opsFundContract.OPS_MANAGER_ROLE(), managerContract.address));
        } else {
            console.log("Ops manager role already granted.");
        }

        if (!(getAddress(await managerContract.opsFundContractAddress()) == getAddress(opsFundContract.address))) {
            console.log("Setting ops fund contract address...");
            await execute(await managerContract.setOpsFundContractAddress(opsFundContract.address));
        } else {
            console.log("Ops fund contract address already set.");
        }
    }

    // Fetch the manager UI contract
    const {contract: managerUI} = await deploy({
        contractName: "BicycleComponentManagerUI",
        chainId,
        onlyFetch: true,
    });

    console.log("Set trusted forwarder on BicycleComponentManagerUI...");
    {
        const trustedForwarder = deploymentParams[getNetworkName(chainId)]?.gsnTrustedForwarder || "";

        if (trustedForwarder && !(getAddress(trustedForwarder) == ZeroAddress)) {
            if (!(getAddress(await managerUI.getTrustedForwarder()) == getAddress(trustedForwarder))) {
                console.log(`Setting trusted forwarder to ${trustedForwarder}...`);
                await execute(await managerUI.setTrustedForwarder(trustedForwarder));
            } else {
                console.log("Trusted forwarder already set.");
            }
        } else {
            console.error(" (!) No trusted forwarder address found in deploymentParams.");
        }
    }

    console.log("Whitelisting methods...");
    {
        const whitelist = async (methodName: string) => {
            const fragment = managerUI.interface.getFunction(methodName);
            const sighash = managerUI.interface.getSighash(fragment);

            if (await paymasterContract.methodWhitelist(managerUI.address, sighash)) {
                console.log(`Method "${methodName}" is already whitelisted.`);
            } else {
                await paymasterContract.connect(deployer).whitelistMethod(managerUI.address, sighash, true);
                console.log(`Whitelisted method "${methodName}".`);
            }
        };

        const whitelisted = [
            "register", "transfer", "updateNFT", "updateAddressInfo"
        ]

        for (const methodName of whitelisted) {
            await whitelist(methodName);
        }
    }

    // console.log("Carte blanche...");
    // if (chainId == 1337 || chainId == 31337) {
    //     console.log("Setting carte blanche...");
    //     const userAddress = "0x87dfc978e6104EcB7A1A992C22a520A55722F238";
    //     await execute(await paymasterContract.setCarteBlanche(managerUI.address, true));
    // }

    console.log("Fund the paymaster, etc (if on Ganache or Localhost)");
    if (chainId == 1337 || chainId == 31337) {
        if (ethers.utils.formatEther(await deployer.getBalance()) < 10) {
            throw new Error("Deployer's balance is less than 10 ETH!");
        }

        const amount_eth = 1;
        console.log(`Funding paymaster (${amount_eth} ETH)...`);
        await execute(await deployer.sendTransaction({
            to: paymasterContract.address,
            value: ethers.utils.parseEther(amount_eth.toString()),
        }));

        // Fund "Rinkeby 10"
        const rinkeby10 = "0x637A5353D5FAb765Ff9265ADb518cd976DD2498A";
        const rinkeby10_amount = 1;
        console.log(`Funding ${rinkeby10} (${rinkeby10_amount} ETH)...`);
        await execute(await deployer.sendTransaction({
            to: rinkeby10,
            value: ethers.utils.parseEther(rinkeby10_amount.toString()),
        }));

        // Give Rinkeby 10 some Ops Tokens in the opsFundContract
        await execute(await opsFundContract.connect(deployer).addAllowance(rinkeby10, 9));
    }
}

if (require.main === module) {
    main().catch(console.error);
}
