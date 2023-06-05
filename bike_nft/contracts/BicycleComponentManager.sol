// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "./BicycleComponents.sol";
import "./Utils.sol";


/// @title Bicycle Component Manager Contract
/// @notice This contract manages the BicycleComponents NFT contract.
contract BicycleComponentManager is Initializable, PausableUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    using Utils for string;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    uint256 public minAmountOnRegister;
    uint256 public maxAmountOnRegister;

    address public nftContractAddress;

    mapping(address => string) private _accountInfo;
    mapping(uint256 => bool) private _missingStatus;
    mapping(uint256 => mapping(address => bool)) private _componentOperatorApproval;

    // Upgraded
    bytes32 public constant UI_ROLE = keccak256("UI_ROLE");

    event AccountInfoSet(address indexed account, string info);
    event ComponentRegistered(address indexed owner, string indexed serialNumber, uint256 indexed tokenId, string uri);
    event UpdatedComponentURI(string indexed serialNumber, uint256 indexed tokenId, string uri);
    event ComponentTransferred(string indexed serialNumber, uint256 indexed tokenId, address indexed to);
    event UpdatedMissingStatus(string indexed serialNumber, uint256 indexed tokenId, bool indexed isMissing);
    event UpdatedComponentOperatorApproval(address indexed operator, string indexed serialNumber, uint256 indexed tokenId, bool approved);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() initializer public {
        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        _grantRole(REGISTRAR_ROLE, msg.sender);
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function _authorizeUpgrade(address newImplementation)
    internal
    onlyRole(UPGRADER_ROLE)
    override
    {}

    function setNftContractAddress(address newAddress) public onlyRole(DEFAULT_ADMIN_ROLE) {
        nftContractAddress = newAddress;
    }

    // Convert a `serialNumber` string to a `tokenId` uint256
    function generateTokenId(string memory serialNumber) public pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(serialNumber)));
    }

    // Management rights

    function ownerOf(string memory serialNumber) public view returns (address) {
        try BicycleComponents(nftContractAddress).ownerOf(generateTokenId(serialNumber)) returns (address owner) {
            return owner;
        } catch {
            return address(0);
        }
    }

    function canHandle(address operator, string memory serialNumber) public view returns (bool) {
        require(operator != address(0), "Nonexistent operator");
        require(ownerOf(serialNumber) != address(0), "Serial number not registered");

        return (operator == ownerOf(serialNumber)) || componentOperatorApproval(serialNumber, operator) || hasRole(DEFAULT_ADMIN_ROLE, operator);
    }

    function canRegister(address operator) public view returns (bool) {
        require(operator != address(0), "Nonexistent operator");
        return hasRole(REGISTRAR_ROLE, operator);
    }

    function canSetAccountInfo(address operator, address account) public view returns (bool) {
        require(operator != address(0), "Nonexistent operator");
        return (operator == account) || hasRole(REGISTRAR_ROLE, operator) || hasRole(DEFAULT_ADMIN_ROLE, operator);
    }

    // Core functions.
    // These functions trust the caller that the registrar/operator is who they say they are.

    function _register(address owner, string memory serialNumber, string memory uri, address registrar)
    internal
    whenNotPaused
    {
        require(canRegister(registrar), "Insufficient rights");

        require(msg.value >= minAmountOnRegister, "Insufficient payment");

        // Assume that `registrar` is a bike shop registering
        // a new `serialNumber` for a customer (`owner`).

        uint256 tokenId = generateTokenId(serialNumber);

        BicycleComponents bicycleComponents = BicycleComponents(nftContractAddress);

        bicycleComponents.safeMint(owner, tokenId);
        bicycleComponents.setTokenURI(tokenId, uri);

        //
        emit ComponentRegistered(owner, serialNumber, tokenId, uri);

        // Grant the "bike shop" the right to handle the NFT on behalf of the "customer".
        // Can't use `setComponentOperatorApproval` here due to "Insufficient rights".
        _componentOperatorApproval[tokenId][registrar] = true;
        emit UpdatedComponentOperatorApproval(registrar, serialNumber, tokenId, true);

        // Return any excess amount to the original sender
        if (msg.value > maxAmountOnRegister) {
            bool success = payable(msg.sender).send(msg.value - maxAmountOnRegister);
            require(success, "BicycleComponentManager: Failed to send excess amount");
        }
    }

    function _transfer(string memory serialNumber, address to, address operator)
    internal
    whenNotPaused
    {
        require(canHandle(operator, serialNumber), "Insufficient rights");

        uint256 tokenId = generateTokenId(serialNumber);

        BicycleComponents(nftContractAddress).transfer(tokenId, to);
        emit ComponentTransferred(serialNumber, tokenId, to);
    }

    // Public-facing core functions

    function transfer(string memory serialNumber, address to) public {
        _transfer(serialNumber, to, _msgSender());
    }

    function transferByUI(string memory serialNumber, address to, address operator) public onlyRole(UI_ROLE) {
        _transfer(serialNumber, to, operator);
    }

    function register(address owner, string memory serialNumber, string memory uri) public payable {
        _register(owner, serialNumber, uri, _msgSender());
    }

    function registerByUI(address owner, string memory serialNumber, string memory uri, address registrar) public payable onlyRole(UI_ROLE) {
        _register(owner, serialNumber, uri, registrar);
    }

    // Withdrawal

    function withdraw() public {
        withdrawTo(_msgSender());
    }

    function withdrawTo(address to) public onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 contractBalance = address(this).balance;
        require(contractBalance > 0, "I'm broke");
        payable(to).transfer(contractBalance);
    }

    // Value on register

    function setMinAmountOnRegister(uint256 newAmount) public onlyRole(DEFAULT_ADMIN_ROLE) {
        minAmountOnRegister = newAmount;
    }

    function setMaxAmountOnRegister(uint256 newAmount) public onlyRole(DEFAULT_ADMIN_ROLE) {
        maxAmountOnRegister = newAmount;
    }

    // Internal setters

    function _setComponentURI(string memory serialNumber, string memory uri, address operator)
    internal whenNotPaused
    {
        require(canHandle(operator, serialNumber), "Insufficient rights");

        uint256 tokenId = generateTokenId(serialNumber);

        BicycleComponents(nftContractAddress).setTokenURI(tokenId, uri);

        emit UpdatedComponentURI(serialNumber, tokenId, uri);
    }

    function _setMissingStatus(string memory serialNumber, bool isMissing, address operator)
    internal whenNotPaused
    {
        require(canHandle(operator, serialNumber), "Insufficient rights");

        uint256 tokenId = generateTokenId(serialNumber);

        _missingStatus[tokenId] = isMissing;
        emit UpdatedMissingStatus(serialNumber, tokenId, isMissing);
    }

    function _setAccountInfo(address account, string memory info, address operator)
    internal whenNotPaused
    {
        require(canSetAccountInfo(operator, account), "Insufficient rights");

        require(bytes(info).length > 0, "Info string is empty");

        _accountInfo[account] = info;
        emit AccountInfoSet(account, info);
    }

    function _setComponentOperatorApproval(string memory serialNumber, address newOperator, bool approved, address operator)
    internal whenNotPaused
    {
        require(canHandle(operator, serialNumber), "Insufficient rights");

        require(newOperator != address(0), "Zero address");

        uint256 tokenId = generateTokenId(serialNumber);

        _componentOperatorApproval[tokenId][newOperator] = approved;
        emit UpdatedComponentOperatorApproval(newOperator, serialNumber, tokenId, approved);
    }

    // Public getters and setters

    function componentURI(string memory serialNumber) public view returns (string memory) {
        return BicycleComponents(nftContractAddress).tokenURI(generateTokenId(serialNumber));
    }

    function setComponentURI(string memory serialNumber, string memory uri) public {
        _setComponentURI(serialNumber, uri, _msgSender());
    }

    function setComponentURIByUI(string memory serialNumber, string memory uri, address operator) public onlyRole(UI_ROLE) {
        _setComponentURI(serialNumber, uri, operator);
    }

    function missingStatus(string memory serialNumber) public view returns (bool) {
        return _missingStatus[generateTokenId(serialNumber)];
    }

    function setMissingStatus(string memory serialNumber, bool isMissing) public {
        _setMissingStatus(serialNumber, isMissing, _msgSender());
    }

    function setMissingStatusByUI(string memory serialNumber, bool isMissing, address operator) public onlyRole(UI_ROLE) {
        _setMissingStatus(serialNumber, isMissing, operator);
    }

    function accountInfo(address account) public view returns (string memory) {
        return _accountInfo[account];
    }

    function setAccountInfo(address account, string memory info) public {
        _setAccountInfo(account, info, _msgSender());
    }

    function setAccountInfoByUI(address account, string memory info, address operator) public onlyRole(UI_ROLE) {
        _setAccountInfo(account, info, operator);
    }

    function componentOperatorApproval(string memory serialNumber, address operator) public view returns (bool) {
        return _componentOperatorApproval[generateTokenId(serialNumber)][operator];
    }

    function setComponentOperatorApproval(string memory serialNumber, address operator, bool approved) public {
        _setComponentOperatorApproval(serialNumber, operator, approved, _msgSender());
    }

    function setComponentOperatorApprovalByUI(string memory serialNumber, address newOperator, bool approved, address operator) public onlyRole(UI_ROLE) {
        _setComponentOperatorApproval(serialNumber, newOperator, approved, operator);
    }

    // Convenience functions

    function setOnChainComponentMetadata(string memory serialNumber, string memory name, string memory description, string memory imageURL)
    public
    {
        string[] memory emptyArray;

        string memory uri = string("").stringifyOnChainMetadata(name, description, imageURL, emptyArray, emptyArray).packJSON();

        setComponentURI(serialNumber, uri);
    }
}
