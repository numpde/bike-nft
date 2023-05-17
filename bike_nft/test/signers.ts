import {ethers} from "hardhat";

export async function getSigners(): Promise<{_, deployer, admin, upgrader, pauser, manager, shop1, shop2, customer1, customer2, third}> {
    const [_, deployer, admin, upgrader, pauser, manager, shop1, shop2, customer1, customer2, third] = await ethers.getSigners();
    return {_, deployer, admin, upgrader, pauser, manager, shop1, shop2, customer1, customer2, third};
}
