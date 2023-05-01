import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("BicycleComponentV1", function () {
  async function deployBicycleComponentFixture() {
    const [owner, otherAccount] = await ethers.getSigners();

    const MainContract = await ethers.getContractFactory("BicycleComponentV1");
    const mainContract = await Lock.deploy({ value: 0 });

    return { mainContract };
  }


});
