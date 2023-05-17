// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "../../Utils.sol";


contract UtilsTest {
    using Utils for string;

    function stringifyOnChainMetadata(string memory spacer, string memory name, string memory description, string memory imageURL, string[] memory traitTypes, string[] memory traitValues)
    public pure returns (string memory)
    {
        return Utils.stringifyOnChainMetadata(spacer, name, description, imageURL, traitTypes, traitValues);
    }

    function packJSON(string memory jsonString)
    public pure returns (string memory)
    {
        return Utils.packJSON(jsonString);
    }
}
