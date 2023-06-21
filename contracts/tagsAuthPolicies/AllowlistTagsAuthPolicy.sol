// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./BaseTagsAuthPolicy.sol";

/**
 * @title AllowlistTagsAuthPolicy
 * @notice A common implementation of TagsAuthPolicy that can be used to restrict minting
 * guild tags to only allowlisted addresses.
 * A separate allowlist is maintained per each guild, and may only be updated by that guild's registered admin.
 */
contract AllowlistTagsAuthPolicy is BaseTagsAuthPolicy {
    mapping(bytes32 => mapping(address => bool)) public guildAllowlists;

    // solhint-disable-next-line no-empty-blocks
    constructor(IENSGuilds ensGuilds) BaseTagsAuthPolicy(ensGuilds) {}

    modifier onlyGuildAdmin(bytes32 guildHash) {
        // solhint-disable-next-line reason-string
        require(_ensGuilds.guildAdmin(guildHash) == _msgSender());
        _;
    }

    function allowMint(bytes32 guildHash, address minter) external onlyGuildAdmin(guildHash) {
        guildAllowlists[guildHash][minter] = true;
    }

    function disallowMint(bytes32 guildHash, address minter) external onlyGuildAdmin(guildHash) {
        guildAllowlists[guildHash][minter] = false;
    }

    /**
     * @inheritdoc ITagsAuthPolicy
     */
    function canClaimTag(
        bytes32 guildHash,
        bytes32,
        address claimant,
        address,
        bytes calldata
    ) external view virtual override returns (bool) {
        return guildAllowlists[guildHash][claimant];
    }

    /**
     * @dev removes the claimant from the guild's allowlist
     */
    function _onTagClaimed(
        bytes32 guildHash,
        bytes32,
        address claimant,
        address,
        bytes calldata
    ) internal virtual override returns (bytes32 tagToRevoke) {
        guildAllowlists[guildHash][claimant] = false;
        return 0;
    }

    /**
     * @inheritdoc ITagsAuthPolicy
     */
    function tagCanBeRevoked(address, bytes32, bytes32, bytes calldata) external view virtual override returns (bool) {
        return false;
    }
}
