// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../interfaces/IENSGuilds.sol";
import "../interfaces/IENSGuildsHumanized.sol";
import "../../libraries/ENSNamehash.sol";

abstract contract ENSGuildsHumanized is IENSGuildsHumanized {
    using ENSNamehash for bytes;

    // Humanized versions

    /**
     * @notice Registers a new guild from an existing ENS domain.
     * Caller must be the ENS node's owner and ENSGuilds must have been designated an "operator" for the caller.
     * @param ensName The guild's full domain name (e.g. 'my-guild.eth')
     * @param admin The address that will administrate this guild
     * @param feePolicy The address of an implementation of FeePolicy to use for minting new tags within this guild
     * @param tagsAuthPolicy The address of an implementation of TagsAuthPolicy to use for minting new tags
     * within this guild
     */
    function registerGuild(
        string memory ensName,
        address admin,
        address feePolicy,
        address tagsAuthPolicy
    ) external override {
        bytes32 ensNode = bytes(ensName).namehash();
        registerGuild(ensNode, admin, feePolicy, tagsAuthPolicy);
    }

    /**
     * @notice De-registers a registered guild.
     * Designates guild as inactive and marks all tags previously minted for that guild as eligible for revocation.
     * @param guildEnsName The guild's full domain name (e.g. 'my-guild.eth')
     */
    function deregisterGuild(string memory guildEnsName) external {
        bytes32 guildEnsNode = bytes(guildEnsName).namehash();
        deregisterGuild(guildEnsNode);
    }

    /**
     * @notice Claims a guild tag
     * @param guildEnsName The guild's full domain name (e.g. 'my-guild.eth')
     * @param tag The tag to claim (e.g. 'foobar')
     * @param recipient The address that will receive this guild tag (usually same as the caller)
     * @param extraClaimArgs [Optional] Any additional arguments necessary for guild-specific logic,
     *  such as authorization
     */
    function claimGuildTag(
        string memory guildEnsName,
        string memory tag,
        address recipient,
        bytes calldata extraClaimArgs
    ) external payable override {
        bytes32 guildEnsNode = bytes(guildEnsName).namehash();
        bytes32 tagHash = keccak256(bytes(tag));
        claimGuildTag(guildEnsNode, tagHash, recipient, extraClaimArgs);
    }

    /**
     * @notice Attempts to revoke an existing guild tag, if authorized by the guild's AuthPolicy.
     * Deregistered guilds will bypass auth checks for revocation of all tags.
     * @param guildEnsName The guild's full domain name (e.g. 'my-guild.eth')
     * @param tag The tag to revoke (e.g. 'foobar')
     * @param extraData [Optional] Any additional arguments necessary for assessing whether a tag may be revoked
     */
    function revokeGuildTag(string memory guildEnsName, string memory tag, bytes calldata extraData) external {
        bytes32 guildEnsNode = bytes(guildEnsName).namehash();
        bytes32 tagHash = keccak256(bytes(tag));
        revokeGuildTag(guildEnsNode, tagHash, extraData);
    }

    /**
     * @notice Returns the current owner of the given guild tag.
     * Returns address(0) if no such guild or tag exists, or if the guild has been deregistered.
     * @param guildEnsName The guild's full domain name (e.g. 'my-guild.eth')
     * @param tag The tag (e.g. 'foobar')
     */
    function tagOwner(string memory guildEnsName, string memory tag) external view returns (address) {
        bytes32 guildEnsNode = bytes(guildEnsName).namehash();
        bytes32 tagHash = keccak256(bytes(tag));
        return tagOwner(guildEnsNode, tagHash);
    }

    /**
     * @notice Updates the FeePolicy for an existing guild. May only be called by the guild's registered admin.
     * @param guildEnsName The guild's full domain name (e.g. 'my-guild.eth')
     * @param feePolicy The address of an implementation of FeePolicy to use for minting new tags within this guild
     */
    function updateGuildFeePolicy(string memory guildEnsName, address feePolicy) external {
        bytes32 guildEnsNode = bytes(guildEnsName).namehash();
        updateGuildFeePolicy(guildEnsNode, feePolicy);
    }

    /**
     * @notice Updates the TagsAuthPolicy for an existing guild. May only be called by the guild's registered admin.
     * @param guildEnsName The guild's full domain name (e.g. 'my-guild.eth')
     * @param tagsAuthPolicy The address of an implementation of TagsAuthPolicy to use for
     * minting new tags within this guild
     */
    function updateGuildTagsAuthPolicy(string memory guildEnsName, address tagsAuthPolicy) external {
        bytes32 guildEnsNode = bytes(guildEnsName).namehash();
        updateGuildTagsAuthPolicy(guildEnsNode, tagsAuthPolicy);
    }

    /**
     * @notice Sets the metadata URI template string for fetching metadata for a guild's tag NFTs.
     * May only be called by the guild's registered admin.
     * @param guildEnsName The guild's full domain name (e.g. 'my-guild.eth')
     * @param uriTemplate The ERC1155 metadata URL template
     */
    function setGuildTokenUriTemplate(string memory guildEnsName, string calldata uriTemplate) external {
        bytes32 guildEnsNode = bytes(guildEnsName).namehash();
        setGuildTokenUriTemplate(guildEnsNode, uriTemplate);
    }

    /**
     * @notice Sets a guild as active or inactive. May only be called by the guild's registered admin.
     * @param guildEnsName The guild's full domain name (e.g. 'my-guild.eth')
     * @param active The new status
     */
    function setGuildActive(string memory guildEnsName, bool active) external {
        bytes32 guildEnsNode = bytes(guildEnsName).namehash();
        setGuildActive(guildEnsNode, active);
    }

    /**
     * @notice Returns the current admin registered for the given guild.
     * @param guildEnsName The guild's full domain name (e.g. 'my-guild.eth')
     */
    function guildAdmin(string memory guildEnsName) external view returns (address) {
        bytes32 guildEnsNode = bytes(guildEnsName).namehash();
        return guildAdmin(guildEnsNode);
    }

    /**
     * @notice Transfers the role of guild admin to the given address.
     * May only be called by the guild's registered admin.
     * @param guildEnsName The guild's full domain name (e.g. 'my-guild.eth')
     * @param newAdmin The new admin
     */
    function transferGuildAdmin(string memory guildEnsName, address newAdmin) external {
        bytes32 guildEnsNode = bytes(guildEnsName).namehash();
        transferGuildAdmin(guildEnsNode, newAdmin);
    }

    // Original versions

    function registerGuild(bytes32, address, address, address) public virtual;

    function deregisterGuild(bytes32) public virtual;

    function claimGuildTag(bytes32, bytes32, address, bytes calldata) public payable virtual;

    function revokeGuildTag(bytes32, bytes32, bytes calldata) public virtual;

    function tagOwner(bytes32, bytes32) public view virtual returns (address);

    function updateGuildFeePolicy(bytes32, address) public virtual;

    function updateGuildTagsAuthPolicy(bytes32, address) public virtual;

    function setGuildTokenUriTemplate(bytes32, string calldata) public virtual;

    function setGuildActive(bytes32, bool) public virtual;

    function guildAdmin(bytes32) public view virtual returns (address);

    function transferGuildAdmin(bytes32, address) public virtual;
}
