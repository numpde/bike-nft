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

    function viewD(address userAddress) public pure returns (string memory nextUI, uint256 tokenId, uint256 tokenCount) {
        BlanksOpenSea blanksContract = BlanksOpenSea(blanksContractAddress);

        uint256 tokenId = blanksContract.BLANK_NFT_TOKEN_ID_D;
        uint256 tokenCount = blanksContract.balanceOf(userAddress, tokenId);

        // todo: return "no tokens" view if user has no tokens

        string memory nextUI = "http:";

        return (nextUI, tokenId, tokenCount);
    }

    function viewTransfer(address userAddress, uint256 tokenId) public view returns (string memory) {
        (userAddress, tokenId);
        return "";
    }

    function initiateTransfer() public {

    }
}
