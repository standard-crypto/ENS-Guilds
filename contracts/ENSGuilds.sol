// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@ensdomains/ens-contracts/contracts/registry/ENS.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/IAddressResolver.sol";

import "./IENSGuilds.sol";
import "./IFeePolicy.sol";
import "./ITagsAuthPolicy.sol";
import "./ENSResolver.sol";

contract ENSGuilds is AccessControlEnumerable, ERC1155, Pausable, IENSGuilds, ENSResolver {
    struct GuildInfo {
        address admin;
        IFeePolicy feePolicy;
        ITagsAuthPolicy tagsAuthPolicy;
        bool active;
    }

    // NOTE: reference for ERC1155 NFT here: https://github.com/enjin/erc-1155/blob/master/contracts/ERC1155MixedFungible.sol

    using ERC165Checker for address;

    /** State */
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    ENS public ensRegistry;
    mapping(bytes32 => GuildInfo) public guilds;

    /** Errors */
    error GuildRegistration_AlreadyRegistered();
    error GuildRegistration_IncorrectENSResolver();
    error GuildRegistration_InvalidPolicy(address);

    constructor(
        string memory uri,
        ENS _ensRegistry,
        IAddressResolver _fallbackEnsResolver
    ) ERC1155(uri) ENSResolver(_fallbackEnsResolver) {
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
    ) public view virtual override(AccessControlEnumerable, ENSResolver, ERC1155, IERC165) returns (bool) {
        return
            ENSResolver.supportsInterface(interfaceId) ||
            ERC1155.supportsInterface(interfaceId) ||
            AccessControlEnumerable.supportsInterface(interfaceId);
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override(ERC1155) {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    function registerGuild(
        bytes32 guildHash,
        address guildAdmin,
        address feePolicy,
        address tagsAuthPolicy
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
        if (!feePolicy.supportsInterface(type(IFeePolicy).interfaceId)) {
            revert GuildRegistration_InvalidPolicy(feePolicy);
        }
        if (!tagsAuthPolicy.supportsInterface(type(ITagsAuthPolicy).interfaceId)) {
            revert GuildRegistration_InvalidPolicy(tagsAuthPolicy);
        }

        guilds[guildHash] = GuildInfo({
            admin: guildAdmin,
            feePolicy: IFeePolicy(feePolicy),
            tagsAuthPolicy: ITagsAuthPolicy(tagsAuthPolicy),
            active: true
        });

        emit Registered(guildHash);
    }

    function deregisterGuild(bytes32 guildHash) external override {
        require(guilds[guildHash].admin == _msgSender());

        delete guilds[guildHash];

        emit Deregistered(guildHash);
    }

    function claimGuildTag(
        bytes32 guildHash,
        bytes32 tagHash,
        address recipient,
        bytes calldata extraClaimArgs
    ) external payable override {}

    function claimGuildTagsBatch(
        bytes32 guildHash,
        bytes32[] calldata tagHashes,
        address[] calldata recipients,
        bytes[] calldata extraClaimArgs
    ) external payable override {}

    function revokeGuildTag(bytes32 guildHash, bytes32 tagHash) public override {}

    function updateGuildFeePolicy(bytes32 guildHash, address feePolicy) external override {}

    function updateGuildTagsAuthPolicy(bytes32 guildHash, address tagsAuthPolicy) external override {}

    function transferGuildAdmin(bytes32 guildHash, address newAdmin) external override {
        // TODO: can admin be 0?
    }

    // TODO: helper view for calculating guild's token ID prefix?
}
