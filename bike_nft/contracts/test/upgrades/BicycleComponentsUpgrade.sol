// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "../../BicycleComponents.sol";

contract BicycleComponentsUpgrade is BicycleComponents {
    function getVersion() public pure returns (uint256) {
        return 2;
    }
}
