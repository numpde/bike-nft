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

    modifier _onlyRegistrar(address userAddress) {
        // Note: `_msgSender()` checks whether `msg.sender` is a trusted forwarder.
        require(
            userAddress == _msgSender(),
            "BicycleComponentManagerUI: userAddress and _msgSender don't match (or not a trusted forwarder)"
        );

        require(
            _isRegistrar(userAddress),
            "BicycleComponentManagerUI: userAddress is not a registrar"
        );

        _;
    }

    function _ownerOf(string memory registerSerialNumber) internal view returns (address) {
        BicycleComponentManager bcm = _bcm();

        try bcm.ownerOf(registerSerialNumber) returns (address owner) {
            return owner;
        } catch (bytes memory) {
            return address(0);
        }
    }

    function viewEntry(address userAddress)
    external view
    returns (string memory, string memory userAddressInfo)
    {
        if (_isRegistrar(userAddress)) {
            return (_composeWithBaseURI("viewEntry.isRegistrar.returns.json"), _bcm().accountInfo(userAddress));
        } else {
            return (_composeWithBaseURI("viewEntry.noRegistrar.returns.json"), _bcm().accountInfo(userAddress));
        }
    }

    function viewIsNewSerialNumber(string memory registerSerialNumber)
    external view
    returns (string memory, address ownerAddress, string memory ownerInfo, address nftContractAddress, uint256 nftTokenId)
    {
        ownerAddress = _ownerOf(registerSerialNumber);

        if (ownerAddress != address(0)) {
            BicycleComponentManager bcm = _bcm();

            ownerInfo = bcm.accountInfo(ownerAddress); // possibly the empty string

            nftContractAddress = bcm.nftContractAddress();
            nftTokenId = bcm.generateTokenId(registerSerialNumber);

            return (_composeWithBaseURI("viewIsNewSerialNumber.hasSerialNumber.returns.json"), ownerAddress, ownerInfo, nftContractAddress, nftTokenId);
        } else {
            return (_composeWithBaseURI("viewIsNewSerialNumber.newSerialNumber.returns.json"), address(0), "", address(0), 0);
        }
    }

    function viewRegisterForm(address userAddress)
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
    _onlyRegistrar(userAddress)
    {
        // At this point, we know that `userAddress` is a registrar on BicycleComponentManager
        // and could have called its `register` function directly.
        // When this contract invokes `register` on BicycleComponentManager,
        // its `REGISTRAR_ROLE` will be checked there.

        BicycleComponentManager bcm = _bcm();

        string[] memory emptyArray;
        string memory uri = string("").stringifyOnChainMetadata(registerName, registerDescription, registerImageURL, emptyArray, emptyArray).packJSON();

        bcm.register(registerFor, registerSerialNumber, uri);
    }

    function viewRegisterOnFailure() public view returns (string memory) {
        return _composeWithBaseURI("viewRegisterOnFailure.returns.json");
    }

    function viewRegisterOnSuccess() public view returns (string memory) {
        return _composeWithBaseURI("viewRegisterOnSuccess.returns.json");
    }

    function _canHandle(address operator, string memory serialNumber) internal view returns (bool) {
        BicycleComponentManager bcm = _bcm();

        try bcm.canHandle(operator, serialNumber) returns (bool canHandle) {
            return canHandle;
        } catch (bytes memory) {
            // legacy:
            // `canHandle` may not be implemented on the deployed contract
        }

        try bcm.ownerOf(serialNumber) returns (address owner) {
            return (owner == operator) || bcm.componentOperatorApproval(serialNumber, operator) || bcm.hasRole(bcm.DEFAULT_ADMIN_ROLE(), operator);
        } catch (bytes memory) {
            return false;
        }
    }

    function viewTransferNFT(address userAddress, string memory registerSerialNumber)
    external view
    returns (string memory, address ownerAddress)
    {
        ownerAddress = _ownerOf(registerSerialNumber);

        if (ownerAddress != address(0)) {
            return (_composeWithBaseURI("viewTransferNFT.hasSerialNumber.returns.json"), ownerAddress);
        } else {
            return (_composeWithBaseURI("viewTransferNFT.newSerialNumber.returns.json"), ownerAddress);
        }
    }

    function _canUpdateAddressInfo(address ownerAddress) internal view returns (bool) {
        BicycleComponentManager bcm = _bcm();

        // Who's asking? Could they have called `setAccountInfo` on BicycleComponentManager directly?
        return (
            bcm.hasRole(bcm.REGISTRAR_ROLE(), _msgSender()) ||
            ownerAddress == _msgSender()
        );
    }

    function updateAddressInfo(address infoAddress, string memory addressInfo) public {
        require(_canUpdateAddressInfo(infoAddress), "BicycleComponentManagerUI: Insufficient rights");

        BicycleComponentManager bcm = _bcm();
        bcm.setAccountInfo(infoAddress, addressInfo);
    }

    // userAddress: connected address as provided by the front-end
    function viewUpdateUserAddressInfo(address userAddress)
    public view
    returns (string memory, address infoAddress, string memory addressInfo)
    {
        return (
            _composeWithBaseURI("viewUpdateAddressInfo.returns.json"),
            userAddress,
            _bcm().accountInfo(userAddress)
        );
    }

    // ownerAddress: address of the owner of the serial number
    function viewUpdateOwnerAddressInfo(address ownerAddress)
    public view
    returns (string memory, address infoAddress, string memory addressInfo)
    {
        return (
            _composeWithBaseURI("viewUpdateAddressInfo.returns.json"),
            ownerAddress,
            _bcm().accountInfo(ownerAddress)
        );
    }

    function viewUpdateAddressInfoOnFailure() public view returns (string memory) {
        return _composeWithBaseURI("viewUpdateAddressInfoOnFailure.returns.json");
    }

    function viewUpdateAddressInfoOnSuccess(address infoAddress) public view returns (string memory, string memory addressInfo) {
        return (
            _composeWithBaseURI("viewUpdateAddressInfoOnSuccess.returns.json"),
            _bcm().accountInfo(infoAddress)
        );
    }
}
