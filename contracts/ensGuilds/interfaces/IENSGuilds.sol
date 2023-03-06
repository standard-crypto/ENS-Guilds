// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/IAddrResolver.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/IAddressResolver.sol";

interface IENSGuilds is IAddrResolver, IAddressResolver, IERC1155MetadataURI {
    /** Events */
    event Registered(bytes32 indexed guildHash);
    event Deregistered(bytes32 indexed guildHash);
    event TagClaimed(bytes32 indexed guildId, bytes32 indexed tagHash, address recipient);
    event TagRevoked(bytes32 indexed guildId, bytes32 indexed tagHash);
    event FeePolicyUpdated(bytes32 indexed guildId, address feePolicy);
    event TagsAuthPolicyUpdated(bytes32 indexed guildId, address tagsAuthPolicy);
    event AdminTransferred(bytes32 indexed guildId, address newAdmin);
    event SetActive(bytes32 indexed guildId, bool active);
    event TokenUriTemplateSet(bytes32 indexed guildId, string uriTemplate);

    /* Functions */

    /**
     * @notice Registers a new guild from an existing ENS domain.
     * Caller must be the ENS node's owner and ENSGuilds must have been designated an "operator" for the caller.
     * @param guildHash The ENS namehash of the guild's domain
     * @param guildAdmin The address that will administrate this guild
     * @param feePolicy The address of an implementation of FeePolicy to use for minting new tags within this guild
     * @param tagsAuthPolicy The address of an implementaition of TagsAuthPolicy to use for minting new tags within this guild
     */
    function registerGuild(bytes32 guildHash, address guildAdmin, address feePolicy, address tagsAuthPolicy) external;

    /**
     * @notice Deregisters a registered guild.
     * Designates guild as inactive and marks all tags previously minted for that guild as eligible for revocation.
     * @param guildHash The ENS namehash of the guild's domain
     */
    function deregisterGuild(bytes32 guildHash) external;

    /**
     * @notice Claims a guild tag
     * @param guildHash The namehash of the guild for which the tag should be claimed (e.g. namehash('my-guild.eth'))
     * @param tagHash The ENS namehash of the tag being claimed (e.g. keccak256('foo') for foo.my-guild.eth)
     * @param recipient The address that will receive this guild tag (usually same as the caller)
     * @param extraClaimArgs [Optional] Any additional arguments necessary for guild-specific logic,
     *  such as authorization
     */
    function claimGuildTag(
        bytes32 guildHash,
        bytes32 tagHash,
        address recipient,
        bytes calldata extraClaimArgs
    ) external payable;

    /**
     * @notice Claims multiple tags for a guild at once
     * @param guildHash The ENS namehash of the guild's domain
     * @param tagHashes Namehashes of each tag to be claimed
     * @param recipients Recipients of each tag to be claimed
     * @param extraClaimArgs Per-tag extra arguments required for guild-specific logic, such as authorization.
     * Must have same length as array of tagHashes, even if each array element is itself empty bytes
     */
    function claimGuildTagsBatch(
        bytes32 guildHash,
        bytes32[] calldata tagHashes,
        address[] calldata recipients,
        bytes[] calldata extraClaimArgs
    ) external payable;

    /**
     * @notice Returns the current owner of the given guild tag.
     * Returns address(0) if no such guild or tag exists, or if the guild has been deregistered.
     * @param guildHash The ENS namehash of the guild's domain
     * @param tagHash The ENS namehash of the tag (e.g. keccak256('foo') for foo.my-guild.eth)
     */
    function tagOwner(bytes32 guildHash, bytes32 tagHash) external view returns (address);

    /**
     * @notice Attempts to revoke an existing guild tag, if authorized by the guild's AuthPolicy.
     * Deregistered guilds will bypass auth checks for revocation of all tags.
     * @param guildHash The ENS namehash of the guild's domain
     * @param tagHash The ENS namehash of the tag (e.g. keccak256('foo') for foo.my-guild.eth)
     * @param extraData [Optional] Any additional arguments necessary for assessing whether a tag may be revoked
     */
    function revokeGuildTag(bytes32 guildHash, bytes32 tagHash, bytes calldata extraData) external;

    /**
     * @notice Attempts to revoke multiple guild tags
     * @param guildHash The ENS namehash of the guild's domain
     * @param tagHashes ENS namehashes of all tags to revoke
     * @param extraData Additional arguments necessary for assessing whether a tag may be revoked
     */
    function revokeGuildTagsBatch(bytes32 guildHash, bytes32[] calldata tagHashes, bytes[] calldata extraData) external;

    /**
     * @notice Updates the FeePolicy for an existing guild. May only be called by the guild's registered admin.
     * @param guildHash The ENS namehash of the guild's domain
     * @param feePolicy The address of an implementation of FeePolicy to use for minting new tags within this guild
     */
    function updateGuildFeePolicy(bytes32 guildHash, address feePolicy) external;

    /**
     * @notice Updates the TagsAuthPolicy for an existing guild. May only be called by the guild's registered admin.
     * @param guildHash The ENS namehash of the guild's domain
     * @param tagsAuthPolicy The address of an implementaition of TagsAuthPolicy to use for minting new tags within this guild
     */
    function updateGuildTagsAuthPolicy(bytes32 guildHash, address tagsAuthPolicy) external;

    /**
     * @notice Sets the metadata URI template string for fetching metadata for a guild's tag NFTs.
     * May only be called by the guild's registered admin.
     * @param guildHash The ENS namehash of the guild's domain
     * @param uriTemplate The ERC1155 metadata URL template
     */
    function setGuildTokenUriTemplate(bytes32 guildHash, string calldata uriTemplate) external;

    /**
     * @notice Sets a guild as active or inactive. May only be called by the guild's registered admin.
     * @param guildHash The ENS namehash of the guild's domain
     * @param active The new status
     */
    function setGuildActive(bytes32 guildHash, bool active) external;

    /**
     * @notice Returns the current admin registered for the given guild.
     * @param guildHash The ENS namehash of the guild's domain
     */
    function guildAdmin(bytes32 guildHash) external view returns (address);

    /**
     * @notice Transfers the role of guild admin to the given address. May only be called by the guild's registered admin.
     * @param guildHash The ENS namehash of the guild's domain
     * @param newAdmin The new admin
     */
    function transferGuildAdmin(bytes32 guildHash, address newAdmin) external;
}
