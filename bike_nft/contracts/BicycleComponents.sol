// SPDX-License-Identifier: MIT
pragma solidity 0.8.18;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721EnumerableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";


/// @title Bicycle Component NFT Contract
/// @notice This contract stores bicycle components as NFTs.
contract BicycleComponents is Initializable, ERC721Upgradeable, ERC721EnumerableUpgradeable, ERC721URIStorageUpgradeable, PausableUpgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant NFT_MANAGER_ROLE = keccak256("NFT_MANAGER_ROLE");

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() initializer public {
        __ERC721_init("BicycleComponents", "BICO");
        __ERC721Enumerable_init();
        __ERC721URIStorage_init();
        __Pausable_init();
        __AccessControl_init();
        __UUPSUpgradeable_init();

        // By default, we grant only administrative roles to the deployer of the contract but
        // not minting/burning roles, which will be the responsibility of another manager contract

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    // Allow/disallow the managing contract/address to manage the NFTs of this contract

    function hireManager(address account) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(NFT_MANAGER_ROLE, account);
    }

    function fireManager(address account) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(NFT_MANAGER_ROLE, account);
    }

    /**
     * @dev Extends the default behavior of `_isApprovedOrOwner` from the inherited ERC721 contract.
     * In addition to the usual checks, allows `sender` to have the NFT_MANAGER_ROLE.
     * Moreover, this checks that the token exists using `_requireMinted`.
     *
     * @param spender The address to check for approval or ownership.
     * @param tokenId The token ID to check for the given `spender`.
     * @return bool True if the `spender` is owner, has approval or has the NFT_MANAGER_ROLE.
     */
    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view virtual override returns (bool) {
        _requireMinted(tokenId);
         return super._isApprovedOrOwner(spender, tokenId) || hasRole(NFT_MANAGER_ROLE, spender);
    }

    // Note: This is defined as "external"
    function isApprovedOrOwner(address spender, uint256 tokenId) external view returns (bool) {
        return _isApprovedOrOwner(spender, tokenId);
    }

    // ROLE SENTRIES: Pausing the contract

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ROLE SENTRIES: Managing tokens

    function safeMint(address to, uint256 tokenId) external onlyRole(NFT_MANAGER_ROLE) {
        _safeMint(to, tokenId);
    }

    function setTokenURI(uint256 tokenId, string memory uri) external {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not owner/approved");
        _setTokenURI(tokenId, uri);
    }

    function burn(uint256 tokenId) external {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not owner/approved");
        _burn(tokenId);
    }

    // ROLE SENTRIES: Upgrading the contract

    // An implementation of `_authorizeUpgrade` is required
    function _authorizeUpgrade(address newImplementation)
    internal
    onlyRole(UPGRADER_ROLE)
    override
    {}

    // Convenience function for token transfer

    function transfer(uint256 tokenId, address to) external {
        super.safeTransferFrom(ownerOf(tokenId), to, tokenId);
    }

    // The following functions are overrides required by Solidity because:
    // "Two or more base classes define function with same name and parameter types"

    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize)
    internal
    whenNotPaused
    override(ERC721Upgradeable, ERC721EnumerableUpgradeable)
    {
        super._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

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
}
