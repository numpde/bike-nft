import {ethers} from "hardhat";
import {SignerWithAddress} from "@nomiclabs/hardhat-ethers/signers";

export async function getSigners(): Promise<{[key: string]: SignerWithAddress}> {
    const [, deployer, admin, upgrader, pauser, paymaster, manager, shop1, shop2, customer1, customer2, third]
        : SignerWithAddress[]
        = await ethers.getSigners();

    return {deployer, admin, upgrader, pauser, paymaster, manager, shop1, shop2, customer1, customer2, third};
}
