// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/**
 * @title TagsAuthPolicy
 * @notice An interface for Guilds to implement that will control authorization for minting tags within that guild
 */
interface ITagsAuthPolicy is IERC165 {
    /**
     * @notice Checks whether a certain address (claimant) may claim a given guild tag
     * @param guildHash The ENS namehash of the guild's domain
     * @param tagHash The ENS namehash of the tag being claimed (e.g. keccak256('foo') for foo.my-guild.eth)
     * @param claimant The address attempting to claim the tag (not necessarily the address that will receive it)
     * @param recipient The address that would receive the tag
     * @param extraClaimArgs [Optional] Any guild-specific additional arguments required
     */
    function canClaimTag(
        bytes32 guildHash,
        bytes32 tagHash,
        address claimant,
        address recipient,
        bytes calldata extraClaimArgs
    ) external view returns (bool);

    /**
     * @dev Called by ENSGuilds once a tag has been claimed.
     * Provided for auth policies to update local state, such as erasing an address from an allowlist after that
     * address has successfully minted a tag.
     * @param guildHash The ENS namehash of the guild's domain
     * @param tagHash The ENS namehash of the tag being claimed (e.g. keccak256('foo') for foo.my-guild.eth)
     * @param claimant The address that claimed the tag (not necessarily the address that received it)
     * @param recipient The address that received receive the tag
     * @param extraClaimArgs [Optional] Any guild-specific additional arguments required
     */
    function onTagClaimed(
        bytes32 guildHash,
        bytes32 tagHash,
        address claimant,
        address recipient,
        bytes calldata extraClaimArgs
    ) external returns (bytes32 tagToRevoke);

    /**
     * @notice Checks whether a given guild tag is elligible to be revoked
     * @param revokedBy The address that would attempt to revoke it
     * @param guildHash The ENS namehash of the guild's domain
     * @param tagHash The ENS namehash of the tag being claimed (e.g. keccak256('foo') for foo.my-guild.eth)
     * @param extraRevokeArgs Any additional arguments necessary for assessing whether a tag may be revoked
     */
    function tagCanBeRevoked(
        address revokedBy,
        bytes32 guildHash,
        bytes32 tagHash,
        bytes calldata extraRevokeArgs
    ) external view returns (bool);
}
