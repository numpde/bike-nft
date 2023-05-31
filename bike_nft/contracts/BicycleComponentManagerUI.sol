// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@opengsn/contracts/src/ERC2771Recipient.sol";

import "./BicycleComponentManager.sol";
import "./BaseUI.sol";


contract BicycleComponentManagerUI is BaseUI {
    address public bicycleComponentManagerAddress;

    constructor(address payable bcmAddress, address myTrustedForwarder, string memory myBaseURI)
    BaseUI(myTrustedForwarder, myBaseURI)
    {
        setBicycleComponentManagerAddress(bcmAddress);
    }

    function setBicycleComponentManagerAddress(address newAddress) public onlyRole(DEFAULT_ADMIN_ROLE) {
        bicycleComponentManagerAddress = newAddress;
    }

    function viewEntry(address userAddress)
    external view
    returns (string memory)
    {
        return _composeWithBaseURI("viewEntry.returns.json");
    }


}
