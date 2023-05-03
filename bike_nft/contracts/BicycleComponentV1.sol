// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";


/// @title Bicycle Component NFT Contract
/// @notice This contract manages bicycle components as NFTs.
contract BicycleComponentV1 is Initializable, ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC721URIStorageUpgradeable, PausableUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    uint256 public _minAmountOnRegister;

    mapping(address => string) private _addressInfo;
    mapping(uint256 => bool) private _missingStatus;
    mapping(uint256 => mapping(address => bool)) private _tokenOperatorApproval;

    event AddressInfoSet(address indexed addr, string info);
    event ComponentRegistered(address indexed to, uint256 indexed tokenId, string indexed serialNumber, string uri);
    event MissingStatusUpdated(string indexed serialNumber, bool indexed isMissing);
    event TokenOperatorApprovalUpdated(uint256 indexed tokenId, address indexed operator, bool approved);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() initializer public {
        __ERC721_init("BicycleComponentV1", "BICO");
        __ERC721Enumerable_init();
        __ERC721URIStorage_init();
        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        _minAmountOnRegister = 0.0 ether;

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


    // Convert a `serialNumber` string to a `tokenId` uint256
    function generateTokenId(string memory serialNumber) public pure returns (uint256) {
        uint256 tokenId = uint256(keccak256(abi.encodePacked(serialNumber)));
        return tokenId;
    }

    // Modified from the `safeMint` function
    // This will check for duplicate token IDs using `_exists`
    function register(address to, string memory serialNumber, string memory uri)
    public
    payable
    onlyRole(MINTER_ROLE)
    {
        require(msg.value >= _minAmountOnRegister, "Payment is less than the minimum `_minAmountOnRegister`");

        // Assume that `msg.sender` is a bike shop registering
        // a new component with the `serialNumber` for a customer (`to`)

        uint256 tokenId = generateTokenId(serialNumber);
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        // Grant the bike shop the right to handle the NFT on behalf of the new owner
        _tokenOperatorApproval[tokenId][msg.sender] = true;
        emit TokenOperatorApprovalUpdated(tokenId, msg.sender, true);

        //
        emit ComponentRegistered(to, tokenId, serialNumber, uri);

        // Return the excess amount to the sender

        uint256 remainingAmount = msg.value - _minAmountOnRegister;

        if (remainingAmount > 0) {
            payable(msg.sender).transfer(remainingAmount);
        }
    }

    function transfer(string memory serialNumber, address to)
    public
    {
        uint256 tokenId = generateTokenId(serialNumber);
        address from = ownerOf(tokenId);

        // `safeTransferFrom` will consult `_isApprovedOrOwner` on `msg.sender` before calling `_safeTransfer`
        safeTransferFrom(from, to, tokenId);
    }

    /**
     * @dev Extends the default behavior of `_isApprovedOrOwner` from the inherited ERC721 contract.
     * Checks if the given `spender` is either the owner of the specified `tokenId`, has been approved to handle it,
     * has been granted "multiple approval" for that specific `tokenId`, or has the admin role.
     * Additionally, this implementation checks if the token exists using `_exists(tokenId)`.
     *
     * @notice The default behavior (super._isApprovedOrOwner) checks for owner or single approval,
     * and requires the token to exist only per docstring.
     *
     * @param spender The address to check for approval or ownership.
     * @param tokenId The token ID to check for the given `spender`.
     * @return bool True if the `spender` is either the owner, approved,
     *         has "multiple approval" for the token, or has the admin role.
     */
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view virtual override returns (bool) {
        _requireMinted(tokenId);

        return super._isApprovedOrOwner(spender, tokenId) || _tokenOperatorApproval[tokenId][spender] || hasRole(DEFAULT_ADMIN_ROLE, spender);
    }

    function isApprovedOrOwner(address spender, uint256 tokenId) public view returns (bool) {
        return _isApprovedOrOwner(spender, tokenId);
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize)
    internal
    whenNotPaused
    override(ERC721Upgradeable, ERC721EnumerableUpgradeable)
    {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function _afterTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize)
    internal
    override(ERC721Upgradeable)
    {
        super._afterTokenTransfer(from, to, tokenId, batchSize);

        // Note: we do not revoke operator approval when transferring tokens
        // because we typically want the minter to retain the operator right.
        // Otherwise, here would be the place to do it.
        // If the owner has approved another operator, it's their responsibility
        // (but they have to revoke the right /before/ transferring the token).
    }

    // The following functions are overrides required by Solidity.

    function _burn(uint256 tokenId)
    internal
    override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
    {
        super._burn(tokenId);
    }

    function tokenURI(uint256 tokenId)
    public
    view
    override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
    returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
    public
    view
    override(ERC721Upgradeable, ERC721EnumerableUpgradeable, AccessControlUpgradeable)
    returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // Withdrawal

    function withdraw() public {
        withdrawTo(msg.sender);
    }

    function withdrawTo(address to) public onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 contractBalance = address(this).balance;
        require(contractBalance > 0, "There is nothing to withdraw");
        payable(to).transfer(contractBalance);
    }

    // Additional getters / setters

    function missingStatus(string memory serialNumber)
    public view returns (bool)
    {
        uint256 tokenId = generateTokenId(serialNumber);

        _requireMinted(tokenId);

        return _missingStatus[tokenId];
    }

    function setMissingStatus(string memory serialNumber, bool isMissing)
    public
    {
        uint256 tokenId = generateTokenId(serialNumber);

        _requireMinted(tokenId);

        require(_isApprovedOrOwner(msg.sender, tokenId), "The sender does not have the right to report on this token");

        _missingStatus[tokenId] = isMissing;
        emit MissingStatusUpdated(serialNumber, isMissing);
    }

    function addressInfo(address account) public view returns (string memory) {
        string memory info = _addressInfo[account];
        require(bytes(info).length > 0, "Address info has not been set");

        return _addressInfo[account];
    }

    function setAddressInfo(address account, string memory info) public {
        require(bytes(info).length > 0, "Info string cannot be empty");

        _addressInfo[account] = info;
        emit AddressInfoSet(account, info);
    }

    function tokenOperatorApproval(uint256 tokenId, address operator) public view returns (bool) {
        _requireMinted(tokenId);

        return _tokenOperatorApproval[tokenId][operator];
    }

    function setTokenOperatorApproval(uint256 tokenId, address operator, bool approved) public {
        _requireMinted(tokenId);

        require(_isApprovedOrOwner(msg.sender, tokenId), "Insufficient permissions for approval");

        _tokenOperatorApproval[tokenId][operator] = approved;
        emit TokenOperatorApprovalUpdated(tokenId, operator, approved);
    }

    function minAmountOnRegister() public view returns (uint256) {
        return _minAmountOnRegister;
    }

    function setMinAmountOnRegister(uint256 newMinAmount) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _minAmountOnRegister = newMinAmount;
    }
}
