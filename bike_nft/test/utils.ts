import {loadFixture} from "@nomicfoundation/hardhat-network-helpers";
import {expect} from "chai";
import {ethers} from "hardhat";

import {getSigners} from "./signers";

export async function deployUtilsFixture() {
    const {deployer} = await getSigners();

    const Library = await ethers.getContractFactory("UtilsTest");

    const library = await Library.connect(deployer).deploy();

    return {library};
}

describe("Utils", function () {
    it("Should stringify metadata correctly (no attributes)", async function () {
        const {library} = await loadFixture(deployUtilsFixture);

        const metadata = {
            name: "Cannondale Bike",
            description: "Just a bike I like",
            image: "https://example.com/image.png",
        }

        const jsonString = await library.stringifyOnChainMetadata(
            "",
            metadata.name,
            metadata.description,
            metadata.image,
            [],
            [],
        );

        await expect(jsonString).to.equal(JSON.stringify(metadata));
    });

    it("Should stringify metadata correctly (with attributes)", async function () {
        const {library} = await loadFixture(deployUtilsFixture);

        const metadata = {
            name: "Cannondale Bike",
            description: "Just a bike I like",
            image: "https://example.com/image.png",
            attributes: [
                {
                    trait_type: "Terrain",
                    value: "Dirt",
                },
                {
                    trait_type: "Speed",
                    value: "Slow but steady",
                },
            ]
        }

        const types = metadata.attributes.map((attribute) => attribute.trait_type);
        const values = metadata.attributes.map((attribute) => attribute.value);

        const jsonString = await library.stringifyOnChainMetadata(
            "",
            metadata.name,
            metadata.description,
            metadata.image,
            types,
            values,
        );

        await expect(jsonString).to.equal(JSON.stringify(metadata));
    });

    it("Should pack the JSON correctly", async function () {
        const {library} = await loadFixture(deployUtilsFixture);

        const metadata = {
            name: "Cannondale Bike",
            description: "Just a bike I like",
            image: "https://example.com/image.png",
        }

        const jsonString = await library.stringifyOnChainMetadata(
            "",
            metadata.name,
            metadata.description,
            metadata.image,
            [],
            [],
        );

        const candidateString = await library.packJSON(jsonString);
        const referenceString = "data:application/json;base64," + Buffer.from(jsonString).toString('base64');

        await expect(candidateString).to.equal(referenceString);
    });
});
