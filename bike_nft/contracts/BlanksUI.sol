// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@opengsn/contracts/src/ERC2771Recipient.sol";

import "./BlanksOpenSea.sol";


contract BlanksUI is ERC2771Recipient {
    address public blanksContractAddress;
    string public baseURI;

    constructor(address myBlanksContract, address myTrustedForwarder, string memory myBaseURI) {
        _setTrustedForwarder(myTrustedForwarder);
        setBlanksContractAddress(myBlanksContract);
        setBaseURI(myBaseURI);
    }

    // @notice Set the "Blanks" contract to be managed
    function setBlanksContractAddress(address newAddress) public {
        blanksContractAddress = newAddress;
    }

    // @notice Set OpenGSN trusted forwarder address
    function setTrustedForwarder(address newAddress) public {
        _setTrustedForwarder(newAddress);
    }

    // Set base URI for this contract
    function setBaseURI(string memory newBaseURI) public {
        baseURI = newBaseURI;
    }

    function _composeWithBaseURI(string memory path) internal view returns (string memory) {
        return string(abi.encodePacked(baseURI, path));
    }

    // @notice
    function register(
        address userAddress,
        address registerFor,
        uint256 blankTokenId,
        string memory registerSerialNumber,
        string memory registerName,
        string memory registerDescription,
        string memory registerImageURL
    ) public {
        // Check that `userAddress` is indeed the original sender of the transaction
        if (isTrustedForwarder(msg.sender)) {
            require(
                userAddress == _msgSender(),
                "BlanksUI: supplied address and _msgSender don't match"
            );
        } else {
            require(
                userAddress == msg.sender,
                "BlanksUI: supplied address and msg.sender don't match"
            );
        }

        // The `BlanksOpenSea` contract will check that the caller has any tokens `blankTokenId`

        BlanksOpenSea blanksContract = BlanksOpenSea(blanksContractAddress);
        blanksContract.proxiedRegister(blankTokenOwner, registerFor, blankTokenId, registerSerialNumber, registerName, registerDescription, registerImageURL);
    }

    function viewEntryD(address userAddress) public view returns (string memory ui, uint256 blankTokenId, uint256 tokenCount) {
        BlanksOpenSea blanksContract = BlanksOpenSea(blanksContractAddress);

        blankTokenId = blanksContract.BLANK_NFT_TOKEN_ID_D;
        tokenCount = blanksContract.balanceOf(userAddress, blankTokenId);

        if (tokenCount == 0) {
            ui = _composeWithBaseURI("viewEntryD.noToken.returns.json");
        } else {
            ui = _composeWithBaseURI("viewEntryD.hasToken.returns.json");
        }

        return (ui, blankTokenId, tokenCount);
    }

    function viewRegister(address userAddress, uint256 blankTokenId) public view returns (string memory) {
        return _composeWithBaseURI("viewRegister-returns.json");
    }

    function viewRegisterOnSuccess() public pure returns (string memory) {
        return "http:";
    }

    function viewRegisterOnFailure() public pure returns (string memory) {
        return "http:";
    }
}
