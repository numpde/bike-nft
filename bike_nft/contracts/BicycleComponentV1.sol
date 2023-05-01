// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/// @title Bicycle Component NFT Contract
/// @notice This contract manages bicycle components as NFTs.
contract BicycleComponentV1 is Initializable, ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC721URIStorageUpgradeable, PausableUpgradeable, AccessControlUpgradeable {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    mapping(address => string) private _addressInfo;
    mapping(uint256 => bool) private _missingStatus;
    mapping(uint256 => mapping(address => bool)) private _tokenOperatorApproval;

    event AddressInfoSet(address indexed addr, string info);
    event ComponentRegistered(address indexed to, uint256 indexed tokenId, string serialNumber, string uri);
    event MissingStatusUpdated(uint256 indexed tokenId, bool indexed isMissing);
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

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // Convert a `serialNumber` string to a `tokenId` uint256
    function generateTokenId(string memory serialNumber) public pure returns (uint256) {
        uint256 tokenId = uint256(keccak256(abi.encodePacked(serialNumber)));
        return tokenId;
    }

    // Modified from the `safeMint` function
    // This will check for duplicate token IDs using `_exists`
    function register(address to, string memory serialNumber, string memory uri)
    public
    onlyRole(MINTER_ROLE)
    {
        // Assume that `msg.sender` is a bike shop registering
        // a new component with the `serialNumber` for a customer (`to`)

        uint256 tokenId = generateTokenId(serialNumber);
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        // Grant the bike shop the right to handle the NFT on behalf of the new owner
        _tokenOperatorApproval[tokenId][msg.sender] = true;
        emit TokenOperatorApprovalUpdated(tokenId, msg.sender, true);

        emit ComponentRegistered(to, tokenId, serialNumber, uri);
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

    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize)
    internal
    whenNotPaused
    override(ERC721Upgradeable, ERC721EnumerableUpgradeable)
    {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
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

    // Additional getters / setters

    function missingStatus(uint256 tokenId) public view returns (bool) {
        _requireMinted(tokenId);

        return _missingStatus[tokenId];
    }

    function setMissingStatus(uint256 tokenId, bool isMissing)
    public
    {
        _requireMinted(tokenId);

        require(_isApprovedOrOwner(msg.sender, tokenId), "The sender does not have the right to report on this token");

        _missingStatus[tokenId] = isMissing;
        emit MissingStatusUpdated(tokenId, isMissing);
    }

    function addressInfo(address addr) public view returns (string memory) {
        string memory info = _addressInfo[addr];
        require(bytes(info).length > 0, "Address info has not been set");

        return _addressInfo[addr];
    }

    function setAddressInfo(address addr, string memory info) public {
        require(bytes(info).length > 0, "Info string cannot be empty");

        _addressInfo[addr] = info;
        emit AddressInfoSet(addr, info);
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
}
