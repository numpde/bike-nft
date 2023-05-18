// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155BurnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC1155/extensions/ERC1155SupplyUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

import "./BicycleComponentManager.sol";


abstract contract BlanksBase is Initializable, ERC1155Upgradeable, AccessControlUpgradeable, PausableUpgradeable, ERC1155BurnableUpgradeable, ERC1155SupplyUpgradeable, UUPSUpgradeable {
    bytes32 public constant URI_SETTER_ROLE = keccak256("URI_SETTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() initializer public virtual {
        __ERC1155_init("");
        __AccessControl_init();
        __Pausable_init();
        __ERC1155Burnable_init();
        __ERC1155Supply_init();
        __UUPSUpgradeable_init();

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        _grantRole(URI_SETTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(UPGRADER_ROLE, msg.sender);
    }

    function setURI(string memory newuri) public onlyRole(URI_SETTER_ROLE) {
        _setURI(newuri);
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function mint(address account, uint256 id, uint256 amount, bytes memory data)
    public
    onlyRole(MINTER_ROLE)
    {
        _mint(account, id, amount, data);
    }

    function _authorizeUpgrade(address newImplementation)
    internal
    onlyRole(UPGRADER_ROLE)
    override
    {}

    // The following functions are overrides required by Solidity.

    function _beforeTokenTransfer(address operator, address from, address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data)
    internal virtual
    whenNotPaused
    override(ERC1155Upgradeable, ERC1155SupplyUpgradeable)
    {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    function supportsInterface(bytes4 interfaceId)
    public
    view
    override(ERC1155Upgradeable, AccessControlUpgradeable)
    returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}


contract BlanksOpenSea is BlanksBase {
    using Utils for string;

    address public owner;
    string public contractURI;

    address public bicycleComponentManager;

    mapping(uint256 => string) public customTokenURI;

    // 0x0000000000000000000000000000000AFADEDFACEFACADE0FADEAFBA0BABB0B0

    uint256 public constant BLANK_NFT_TOKEN_ID_A = 1;
    uint256 public constant BLANK_NFT_TOKEN_ID_B = 2;
    uint256 public constant BLANK_NFT_TOKEN_ID_C = 3;
    uint256 public constant BLANK_NFT_TOKEN_ID_D = 4;

    event Registered(address indexed tokenOwner, string indexed serialNumber, string tokenURI);

    function initialize() initializer public override {
        BlanksBase.initialize();
        owner = msg.sender;

        _mint(msg.sender, BLANK_NFT_TOKEN_ID_B, 1_000, "");
    }

    // https://support.opensea.io/hc/en-us/articles/4403934341907-How-do-I-import-my-contract-automatically-
    function claimOwnership() public onlyRole(DEFAULT_ADMIN_ROLE) {
        owner = msg.sender;
    }

    // https://docs.opensea.io/docs/contract-level-metadata
    function setContractURI(string memory newURI) public onlyRole(DEFAULT_ADMIN_ROLE) {
        contractURI = newURI;
    }

    function setBicycleComponentManager(address bcmAddress) public onlyRole(DEFAULT_ADMIN_ROLE) {
        bicycleComponentManager = bcmAddress;
    }

    // Token URI: use the default, unless the token has a custom URI

    function setCustomTokenURI(uint256 tokenId, string memory newURI) public onlyRole(URI_SETTER_ROLE) {
        customTokenURI[tokenId] = newURI;
    }

    function uri(uint256 id) public view override returns (string memory) {
        if (bytes(customTokenURI[id]).length > 0) {
            return customTokenURI[id];
        }

        return super.uri(id);
    }

    // Prevent transfers of privileged tokens, except by an admin

    function _isPrivilegedToken(uint256 id) internal pure returns (bool) {
        return (id == BLANK_NFT_TOKEN_ID_A) || (id == BLANK_NFT_TOKEN_ID_B) || (id == BLANK_NFT_TOKEN_ID_C);
    }

    function _beforeTokenTransfer(address operator, address from, address to, uint256[] memory ids, uint256[] memory amounts, bytes memory data)
    internal virtual override
    {
        if (hasRole(DEFAULT_ADMIN_ROLE, operator) || (to == address(0))) {
            // This is ok
        } else {
            // Check for privileged token transfer
            for (uint256 i = 0; i < ids.length; ++i) {
                require(!_isPrivilegedToken(ids[i]), "Transfer of privileged token");
            }
        }

        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    function isApprovedForAll(address _owner, address operator) public view override returns (bool) {
        if (hasRole(DEFAULT_ADMIN_ROLE, operator)) {
            return true;
        }

        return super.isApprovedForAll(_owner, operator);
    }

    function _tokenAuthority(uint256 tokenId) internal pure returns (string memory) {
        if (tokenId == BLANK_NFT_TOKEN_ID_A) {
            return "A";
        } else if (tokenId == BLANK_NFT_TOKEN_ID_B) {
            return "B";
        } else if (tokenId == BLANK_NFT_TOKEN_ID_C) {
            return "C";
        } else if (tokenId == BLANK_NFT_TOKEN_ID_D) {
            return "D";
        } else {
            return "N/A";
        }
    }

    // Blank conversion to NFT

    function _refund(uint256 got, uint256 expected, address to) internal {
        if (got > expected) {
            uint256 refundAmount = got - expected;

            bool refundSuccess = payable(to).send(refundAmount);
            // Alternative:
            // (bool refundSuccess, ) = payable(msg.sender).call{value: refundAmount}("");

            require(refundSuccess, "BlanksOpenSea: Failed to refund excess value");
        }
    }

    // Register a bicycle serial number with the BicycleComponentManager
    function register(uint256 tokenId, string memory serialNumber, string memory name, string memory description, string memory imageURL)
    public payable
    {
        require(bicycleComponentManager != address(0), "BicycleComponentManager not set");

        address tokenOwner = msg.sender;

        uint256 balance = balanceOf(tokenOwner, tokenId);
        require(balance > 0, "Insufficient token balance");

        string[] memory attrT = new string[](1);
        string[] memory attrV = new string[](1);

        attrT[0] = "Authority";
        attrV[0] = _tokenAuthority(tokenId);

        string memory tokenURI = string("").stringifyOnChainMetadata(name, description, imageURL, attrT, attrV).packJSON();

        uint256 forwardAmount = msg.value;
        uint256 balanceBefore = address(this).balance; // includes the forwardAmount received

        BicycleComponentManager bcm = BicycleComponentManager(bicycleComponentManager);

        // Forward any attached value to the BicycleComponentManager
        bcm.register{value: forwardAmount}(tokenOwner, serialNumber, tokenURI);

        // BicycleComponentManager should mint a token for the owner in its
        // managed BicycleComponent NFT contract, so we burn the token here
        _burn(tokenOwner, tokenId, 1);

        // Event
        emit Registered(tokenOwner, serialNumber, tokenURI);

        // BicycleComponentManager may have returned some excess value, so we refund it

        uint256 balanceAfter = address(this).balance;
        uint256 expectedBalanceAfter = balanceBefore - forwardAmount;

        _refund(balanceAfter, expectedBalanceAfter, tokenOwner);
    }

    // Fallback & withdraw

    receive() external payable {
    }

    function withdraw() public onlyRole(DEFAULT_ADMIN_ROLE) {
        payable(msg.sender).transfer(address(this).balance);
    }
}
