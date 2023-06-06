import {ethers} from "hardhat";

export async function getSigners(): Promise<any> {
    const [_, deployer, admin, upgrader, pauser, paymaster, manager, shop1, shop2, customer1, customer2, third] = await ethers.getSigners();
    return {_, deployer, admin, upgrader, pauser, paymaster, manager, shop1, shop2, customer1, customer2, third};
}
