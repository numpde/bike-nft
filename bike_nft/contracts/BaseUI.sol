// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@opengsn/contracts/src/ERC2771Recipient.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";


abstract contract BaseUI is ERC2771Recipient, AccessControl {
    string public baseURI;

    constructor (address myTrustedForwarder, string memory myBaseURI) {
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());

        setTrustedForwarder(myTrustedForwarder);
        setBaseURI(myBaseURI);
    }

    function setTrustedForwarder(address newAddress) public virtual onlyRole(DEFAULT_ADMIN_ROLE) {
        _setTrustedForwarder(newAddress);
    }

    function setBaseURI(string memory newBaseURI) public virtual onlyRole(DEFAULT_ADMIN_ROLE) {
        baseURI = newBaseURI;
    }

    function abiURI() public virtual view returns (string memory) {
        return _composeWithBaseURI("abi.json");
    }

    function _composeWithBaseURI(string memory path) internal view returns (string memory) {
        return string(abi.encodePacked(baseURI, path));
    }

    // Defaults

    receive() external payable {
        revert("Does not accept payments.");
    }

    fallback() external payable {
        revert("Contract function not found.");
    }

    // Overrides resolution

    function _msgSender()
    internal virtual view override(ERC2771Recipient, Context)
    returns (address)
    {
        return ERC2771Recipient._msgSender();
    }

    function _msgData()
    internal virtual view override(ERC2771Recipient, Context)
    returns (bytes calldata ret)
    {
        return ERC2771Recipient._msgData();
    }
}
