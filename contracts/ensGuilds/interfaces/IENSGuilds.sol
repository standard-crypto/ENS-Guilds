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

    /** Functions */

    function registerGuild(bytes32 guildHash, address guildAdmin, address feePolicy, address tagsAuthPolicy) external;

    function deregisterGuild(bytes32 guildHash) external;

    /**
     * Claims a guild tag
     * @param guildHash The namehash of the guild for which the tag should be claimed (e.g. namehash('my-guild.eth'))
     * @param tagHash The ENS namehash of the tag being claimed (e.g. keccak256('foo') for foo.my-guild.eth)
     * @param recipient The address that will receive this guild tag
     * @param extraClaimArgs [Optional] Any additional arguments necessary for guild-specific logic,
     *  such as authorization
     */
    function claimGuildTag(
        bytes32 guildHash,
        bytes32 tagHash,
        address recipient,
        bytes calldata extraClaimArgs
    ) external payable;

    // function claimGuildTagsBatch(
    //     bytes32 guildHash,
    //     bytes32[] calldata tagHashes,
    //     address[] calldata recipients,
    //     bytes[] calldata extraClaimArgs
    // ) external payable;

    function revokeGuildTag(bytes32 guildHash, bytes32 tagHash, bytes calldata extraData) external;

    function updateGuildFeePolicy(bytes32 guildHash, address feePolicy) external;

    function updateGuildTagsAuthPolicy(bytes32 guildHash, address tagsAuthPolicy) external;

    function setGuildTokenUriTemplate(bytes32 guildHash, string calldata uriTemplate) external;

    function setGuildActive(bytes32 guildHash, bool active) external;

    function guildAdmin(bytes32 guildHash) external view returns (address);

    function transferGuildAdmin(bytes32 guildHash, address newAdmin) external;
}
