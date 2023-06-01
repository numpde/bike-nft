// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@opengsn/contracts/src/ERC2771Recipient.sol";

import "./BicycleComponentManager.sol";
import "./BaseUI.sol";
import "./Utils.sol";


contract BicycleComponentManagerUI is BaseUI {
    using Utils for string;

    address public bicycleComponentManagerAddress;

    constructor(address payable bcmAddress, address myTrustedForwarder, string memory myBaseURI)
    BaseUI(myTrustedForwarder, myBaseURI)
    {
        setBicycleComponentManagerAddress(bcmAddress);
    }

    function setBicycleComponentManagerAddress(address newAddress) public onlyRole(DEFAULT_ADMIN_ROLE) {
        bicycleComponentManagerAddress = newAddress;
    }

    function _bcm() internal view returns (BicycleComponentManager) {
        BicycleComponentManager bcm = BicycleComponentManager(bicycleComponentManagerAddress);
        return bcm;
    }

    function _isRegistrar(address userAddress) internal view returns (bool) {
        BicycleComponentManager bcm = _bcm();
        return bcm.hasRole(bcm.REGISTRAR_ROLE(), userAddress);
    }

    function viewEntry(address userAddress)
    external view
    returns (string memory)
    {
        if (_isRegistrar(userAddress)) {
            return _composeWithBaseURI("viewEntry.isRegistrar.returns.json");
        } else {
            return _composeWithBaseURI("viewEntry.noRegistrar.returns.json");
        }
    }

    function viewIsNewSerialNumber(string memory registerSerialNumber)
    external view
    returns (string memory, address ownerAddress, string memory ownerInfo)
    {
        BicycleComponentManager bcm = _bcm();

        try bcm.ownerOf(registerSerialNumber) returns (address owner) {
            ownerInfo = bcm.accountInfo(owner);

            if (bytes(ownerInfo).length == 0) {
                ownerInfo = "N/A";
            }

            return (_composeWithBaseURI("viewIsNewSerialNumber.hasSerialNumber.returns.json"), owner, ownerInfo);
        } catch (bytes memory) {
            return (_composeWithBaseURI("viewIsNewSerialNumber.newSerialNumber.returns.json"), address(0), "");
        }
    }

    function viewRegisterForm(address userAddress, address registerFor)
    external view
    returns (string memory)
    {
        if (_isRegistrar(userAddress)) {
            return _composeWithBaseURI("viewRegisterForm.isRegistrar.returns.json");
        } else {
            return _composeWithBaseURI("viewRegisterForm.noRegistrar.returns.json");
        }
    }

    function viewRegisterQR() external view returns (string memory)
    {
        return _composeWithBaseURI("viewRegisterQR.returns.json");
    }

    function register(
        address userAddress, // connected address as provided by the front-end
        address registerFor,
        string memory registerSerialNumber,
        string memory registerName,
        string memory registerDescription,
        string memory registerImageURL
    )
    public
    {
        // Note: `_msgSender()` checks whether `msg.sender` is a trusted forwarder.
        require(
            userAddress == _msgSender(),
            "BicycleComponentManagerUI: userAddress and _msgSender don't match (or not a trusted forwarder)"
        );

        BicycleComponentManager bcm = _bcm();

        string[] memory emptyArray;
        string memory uri = string("").stringifyOnChainMetadata(registerName, registerDescription, registerImageURL, emptyArray, emptyArray).packJSON();

        // Checks that this contract has the `REGISTRAR_ROLE`:
        bcm.register(registerFor, registerSerialNumber, uri);
    }

    function viewRegisterOnFailure() public view returns (string memory) {
        return _composeWithBaseURI("viewRegisterOnFailure.returns.json");
    }

    function viewRegisterOnSuccess() public view returns (string memory) {
        return (_composeWithBaseURI("viewRegisterOnSuccess.returns.json"));
    }
}
