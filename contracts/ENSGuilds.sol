// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@ensdomains/ens-contracts/contracts/registry/ENS.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/IAddressResolver.sol";

import "./interfaces/IENSGuilds.sol";
import "./interfaces/IFeePolicy.sol";
import "./interfaces/ITagsAuthPolicy.sol";
import "./ENSResolver.sol";
import "./ENSGuildsToken.sol";

contract ENSGuilds is AccessControlEnumerable, ENSGuildsToken, Pausable, IENSGuilds, ENSResolver, ReentrancyGuard {
    struct GuildInfo {
        address admin;
        IFeePolicy feePolicy;
        ITagsAuthPolicy tagsAuthPolicy;
        bool active;
    }

    using ERC165Checker for address;

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /** State */
    ENS public ensRegistry;
    mapping(bytes32 => GuildInfo) public guilds;

    /** Errors */
    error GuildRegistration_AlreadyRegistered();
    error GuildRegistration_IncorrectENSResolver();
    error GuildRegistration_InvalidPolicy(address);
    error GuildNotActive();
    error ClaimUnauthorized();
    error GuildAdminOnly();
    error TagAlreadyClaimed();
    error FeeError();

    modifier onlyGuildAdmin(bytes32 guildHash) {
        if (guilds[guildHash].admin != _msgSender()) {
            revert GuildAdminOnly();
        }
        _;
    }

    constructor(
        string memory defaultTokenMetadataUri,
        ENS _ensRegistry,
        IAddressResolver _fallbackEnsResolver
    ) ERC1155(defaultTokenMetadataUri) ENSResolver(_fallbackEnsResolver) {
        _setupRole(PAUSER_ROLE, _msgSender());
        ensRegistry = _ensRegistry;
    }

    function pause() public virtual {
        require(hasRole(PAUSER_ROLE, _msgSender()), "ENSGuilds: must have pauser role to pause");
        _pause();
    }

    function unpause() public virtual {
        require(hasRole(PAUSER_ROLE, _msgSender()), "ENSGuilds: must have pauser role to unpause");
        _unpause();
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(AccessControlEnumerable, ENSResolver, ENSGuildsToken, IERC165) returns (bool) {
        return
            ENSResolver.supportsInterface(interfaceId) ||
            ENSGuildsToken.supportsInterface(interfaceId) ||
            AccessControlEnumerable.supportsInterface(interfaceId);
    }

    function registerGuild(
        bytes32 guildHash,
        address admin,
        address feePolicy, // 0 is valid
        address tagsAuthPolicy // 0 is invalid
    ) external override {
        // Check caller is owner of domain
        require(ensRegistry.owner(guildHash) == _msgSender());

        // Check guild not yet registered
        if (address(guilds[guildHash].feePolicy) != address(0)) {
            revert GuildRegistration_AlreadyRegistered();
        }

        // Check ENSGuilds contract has been configured as ENS resolver for the guild
        if (ensRegistry.resolver(guildHash) != address(this)) {
            revert GuildRegistration_IncorrectENSResolver();
        }

        // Check for valid fee/tagsAuth policies
        if (feePolicy != address(0) && !feePolicy.supportsInterface(type(IFeePolicy).interfaceId)) {
            revert GuildRegistration_InvalidPolicy(feePolicy);
        }
        if (!tagsAuthPolicy.supportsInterface(type(ITagsAuthPolicy).interfaceId)) {
            revert GuildRegistration_InvalidPolicy(tagsAuthPolicy);
        }

        guilds[guildHash] = GuildInfo({
            admin: admin,
            feePolicy: IFeePolicy(feePolicy),
            tagsAuthPolicy: ITagsAuthPolicy(tagsAuthPolicy),
            active: true
        });

        emit Registered(guildHash);
    }

    function deregisterGuild(bytes32 guildHash) external override onlyGuildAdmin(guildHash) {
        delete guilds[guildHash];
        emit Deregistered(guildHash);
    }

    function claimGuildTag(
        bytes32 guildHash,
        bytes32 tagHash,
        address recipient,
        bytes calldata extraClaimArgs
    ) external payable override nonReentrant {
        // assert guild is not frozen
        if (!guilds[guildHash].active) {
            revert GuildNotActive();
        }

        // check tag not already claimed
        bytes32 ensNode = keccak256(abi.encodePacked(tagHash, guildHash));
        if (addr(ensNode) != address(0)) {
            revert TagAlreadyClaimed();
        }

        // check caller is authorized to claim tag
        ITagsAuthPolicy auth = guilds[guildHash].tagsAuthPolicy;
        if (!auth.canClaimTag(guildHash, tagHash, _msgSender(), recipient, extraClaimArgs)) {
            revert ClaimUnauthorized();
        }

        // fees
        if (guilds[guildHash].feePolicy != IFeePolicy(address(0))) {
            (address feeToken, uint256 fee, address feePaidTo) = guilds[guildHash].feePolicy.tagClaimFee(
                guildHash,
                tagHash,
                recipient,
                extraClaimArgs
            );
            if (fee != 0) {
                if (feeToken == address(0)) {
                    if (msg.value != fee) {
                        revert FeeError();
                    }
                    (bool sent, ) = feePaidTo.call{ value: msg.value }("");
                    if (!sent) revert FeeError();
                } else {
                    bool sent = IERC20(feeToken).transferFrom(_msgSender(), feePaidTo, fee);
                    if (!sent) revert FeeError();
                }
            }
        }

        // NFT mint
        _mintNewGuildToken(guildHash, recipient);

        // inform auth contract that tag was claimed, optionally revoking an existing tag in the process
        bytes32 tagToRevoke = auth.onTagClaimed(guildHash, tagHash, _msgSender(), recipient, extraClaimArgs);
        if (tagToRevoke != bytes32(0)) {
            _revokeTag(guildHash, tagToRevoke);
        }

        // Set forward record in ENS resolver
        _setEnsForwardRecord(ensNode, recipient);
    }

    function claimGuildTagsBatch(
        bytes32 guildHash,
        bytes32[] calldata tagHashes,
        address[] calldata recipients,
        bytes[] calldata extraClaimArgs
    ) external payable override {}

    function guildAdmin(bytes32 guildHash) external view returns (address) {
        return guilds[guildHash].admin;
    }

    function revokeGuildTag(bytes32 guildHash, bytes32 tagHash, bytes calldata extraData) public override {
        ITagsAuthPolicy auth = guilds[guildHash].tagsAuthPolicy;
        require(auth.tagCanBeRevoked(guildHash, tagHash, extraData));
        _revokeTag(guildHash, tagHash);
    }

    function updateGuildFeePolicy(bytes32 guildHash, address feePolicy) external override onlyGuildAdmin(guildHash) {
        require(feePolicy.supportsInterface(type(IFeePolicy).interfaceId));
        guilds[guildHash].feePolicy = IFeePolicy(feePolicy);
        emit FeePolicyUpdated(guildHash, feePolicy);
    }

    function updateGuildTagsAuthPolicy(
        bytes32 guildHash,
        address tagsAuthPolicy
    ) external override onlyGuildAdmin(guildHash) {
        require(tagsAuthPolicy.supportsInterface(type(ITagsAuthPolicy).interfaceId));
        guilds[guildHash].tagsAuthPolicy = ITagsAuthPolicy(tagsAuthPolicy);
        emit TagsAuthPolicyUpdated(guildHash, tagsAuthPolicy);
    }

    function transferGuildAdmin(bytes32 guildHash, address newAdmin) external override onlyGuildAdmin(guildHash) {
        guilds[guildHash].admin = newAdmin;
        emit AdminTransferred(guildHash, newAdmin);
    }

    function setGuildTokenUriTemplate(
        bytes32 guildHash,
        string calldata uriTemplate
    ) external override onlyGuildAdmin(guildHash) {
        _setGuildTokenURITemplate(guildHash, uriTemplate);
    }

    function setGuildActive(bytes32 guildHash, bool active) external override onlyGuildAdmin(guildHash) {
        guilds[guildHash].active = active;
        emit SetActive(guildHash, active);
    }

    function _revokeTag(bytes32 guildHash, bytes32 tagHash) private {
        bytes32 ensNode = keccak256(abi.encodePacked(tagHash, guildHash));
        // erase ENS forward record
        _setEnsForwardRecord(ensNode, address(0));
        // TODO: burn NFT
        // TODO: erase ENS reverse record?
    }
}
