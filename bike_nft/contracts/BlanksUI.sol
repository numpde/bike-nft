// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@opengsn/contracts/src/ERC2771Recipient.sol";

import "./BlanksOpenSea.sol";


contract BlanksUI is ERC2771Recipient {
    address payable public blanksContractAddress;
    string public baseURI;

    constructor(address payable myBlanksContract, address myTrustedForwarder, string memory myBaseURI) {
        _setTrustedForwarder(myTrustedForwarder);
        setBlanksContractAddress(myBlanksContract);
        setBaseURI(myBaseURI);
    }

    // @notice Set the "Blanks" contract to be managed
    function setBlanksContractAddress(address payable newAddress) public {
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
        address userAddress,  // connected address as provided by the front-end
        address registerFor,
        uint256 blankTokenId,
        string memory registerSerialNumber,
        string memory registerName,
        string memory registerDescription,
        string memory registerImageURL
    )
    public
    returns (uint256 nftTokenId)
    {
        require(
            // Note: `_msgSender()` checks whether `msg.sender` is a trusted forwarder.
            userAddress == _msgSender(),
            "BlanksUI: userAddress and _msgSender don't match (or not a trusted forwarder)"
        );

        // Having verified `userAddress`, we assume that's who is converting their own Blank.
        // The `BlanksOpenSea` contract will check that they indeed have the Blank tokens.
        address blankTokenOwner = userAddress;

        BlanksOpenSea blanksContract = BlanksOpenSea(blanksContractAddress);
        nftTokenId = blanksContract.proxiedRegister(blankTokenOwner, registerFor, blankTokenId, registerSerialNumber, registerName, registerDescription, registerImageURL);

        return nftTokenId;
    }

    function viewEntryD(address userAddress) public view returns (string memory ui, uint256 blankTokenId, uint256 tokenCount) {
        BlanksOpenSea blanksContract = BlanksOpenSea(blanksContractAddress);

        blankTokenId = blanksContract.BLANK_NFT_TOKEN_ID_D();
        tokenCount = blanksContract.balanceOf(userAddress, blankTokenId);

        if (tokenCount == 0) {
            ui = _composeWithBaseURI("viewEntryD.noToken.returns.json");
        } else {
            ui = _composeWithBaseURI("viewEntryD.hasToken.returns.json");
        }

        return (ui, blankTokenId, tokenCount);
    }

    function viewRegister() public view returns (string memory) {
        return _composeWithBaseURI("viewRegister.returns.json");
    }

    function viewRegisterOnSuccess() public view returns (string memory) {
        return _composeWithBaseURI("viewRegisterOnSuccess.returns.json");
    }

    function viewRegisterOnFailure() public view returns (string memory) {
        return _composeWithBaseURI("viewRegisterOnFailure.returns.json");
    }
}
