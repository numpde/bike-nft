// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "./BicycleComponents.sol";

contract BicycleComponentManager is Initializable, PausableUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint256 public minAmountOnRegister;
    uint256 public maxAmountOnRegister;

    address public nftContractAddress;

    mapping(address => string) private _accountInfo;
    mapping(uint256 => bool) private _missingStatus;
    mapping(uint256 => mapping(address => bool)) private _componentOperatorApproval;

    event AccountInfoSet(address indexed account, string info);
    event ComponentRegistered(address indexed owner, string indexed serialNumber, uint256 indexed tokenId, string uri);
    event ComponentTransferred(string indexed serialNumber, uint256 tokenId, address indexed to);
    event MissingStatusUpdated(string indexed serialNumber, uint256 indexed tokenId, bool indexed isMissing);
    event ComponentOperatorApprovalUpdated(address indexed operator, string indexed serialNumber, uint256 indexed tokenId, bool approved);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() initializer public {
        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);

        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
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

    function register(address owner, string memory serialNumber, string memory uri)
    public
    payable
    onlyRole(MINTER_ROLE)
    {
        require(msg.value >= minAmountOnRegister, "Insufficient payment");

        // Assume that `msg.sender` is a bike shop registering
        // a new component with the `serialNumber` for a customer (`to`)

        uint256 tokenId = generateTokenId(serialNumber);

        BicycleComponents bicycleComponents = BicycleComponents(nftContractAddress);

        bicycleComponents.safeMint(owner, tokenId);
        bicycleComponents.setTokenURI(tokenId, uri);

        //
        emit ComponentRegistered(owner, serialNumber, tokenId, uri);

        // Grant the bike shop the right to handle the NFT on behalf of the new owner
        // Can't use `setComponentOperatorApproval` here due to "Insufficient rights"
        _componentOperatorApproval[tokenId][msg.sender] = true;
        emit ComponentOperatorApprovalUpdated(msg.sender, serialNumber, tokenId, true);

        // Return any excess amount to the sender
        if (msg.value > maxAmountOnRegister) {
            payable(msg.sender).transfer(msg.value - maxAmountOnRegister);
        }
    }

    function transfer(string memory serialNumber, address to)
    public
    {
        uint256 tokenId = generateTokenId(serialNumber);

        _requireSenderCanHandle(tokenId);

        BicycleComponents(nftContractAddress).transfer(tokenId, to);
        emit ComponentTransferred(serialNumber, tokenId, to);
    }

    function _canHandle(address spender, uint256 tokenId) internal view virtual returns (bool) {
        return (BicycleComponents(nftContractAddress).ownerOf(tokenId) == spender) || _componentOperatorApproval[tokenId][spender] || hasRole(DEFAULT_ADMIN_ROLE, spender);
    }

    function _requireSenderCanHandle(uint256 tokenId) internal view {
        require(_canHandle(msg.sender, tokenId), "Insufficient rights");
    }

    // Withdrawal

    function withdraw() public {
        withdrawTo(msg.sender);
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

    // Additional getters / setters

    function uri(string memory serialNumber)
    public view returns (string memory)
    {
        return BicycleComponents(nftContractAddress).tokenURI(generateTokenId(serialNumber));
    }

    function setUri(string memory serialNumber, string memory uri)
    public
    {
        uint256 tokenId = generateTokenId(serialNumber);

        _requireSenderCanHandle(tokenId);

        BicycleComponents(nftContractAddress).setTokenURI(tokenId, uri);
    }

    function missingStatus(string memory serialNumber)
    public view returns (bool)
    {
        return _missingStatus[generateTokenId(serialNumber)];
    }

    function setMissingStatus(string memory serialNumber, bool isMissing)
    public
    {
        uint256 tokenId = generateTokenId(serialNumber);

        _requireSenderCanHandle(tokenId);

        _missingStatus[tokenId] = isMissing;
        emit MissingStatusUpdated(serialNumber, tokenId, isMissing);
    }

    function accountInfo(address account) public view returns (string memory) {
        return _accountInfo[account];
    }

    function setAccountInfo(address account, string memory info) public {
        require(bytes(info).length > 0, "Info string is empty");

        _accountInfo[account] = info;
        emit AccountInfoSet(account, info);
    }

    function componentOperatorApproval(string memory serialNumber, address operator) public view returns (bool) {
        return _componentOperatorApproval[generateTokenId(serialNumber)][operator];
    }

    function setComponentOperatorApproval(string memory serialNumber, address operator, bool approved) public {
        uint256 tokenId = generateTokenId(serialNumber);

        _requireSenderCanHandle(tokenId);

        _componentOperatorApproval[tokenId][operator] = approved;
        emit ComponentOperatorApprovalUpdated(operator, serialNumber, tokenId, approved);
    }

    // Convenience functions

    function ownerOf(string memory serialNumber) public view returns (address) {
        return BicycleComponents(nftContractAddress).ownerOf(generateTokenId(serialNumber));
    }
}
