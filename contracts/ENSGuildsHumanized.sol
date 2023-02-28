// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./interfaces/IENSGuilds.sol";
import "./interfaces/IENSGuildsHumanized.sol";
import "./libraries/ENSNamehash.sol";

abstract contract ENSGuildsHumanized is IENSGuilds, IENSGuildsHumanized {
    using ENSNamehash for bytes;

    function registerGuild(
        string memory ensName,
        address admin,
        address feePolicy, // 0 is valid
        address tagsAuthPolicy // 0 is invalid
    ) external override {
        bytes32 ensNode = bytes(ensName).namehash();
        this.registerGuild(ensNode, admin, feePolicy, tagsAuthPolicy);
    }

    function deregisterGuild(string memory guildEnsName) external {
        bytes32 guildEnsNode = bytes(guildEnsName).namehash();
        this.deregisterGuild(guildEnsNode);
    }

    function claimGuildTag(
        string memory guildEnsName,
        string memory tag,
        address recipient,
        bytes calldata extraClaimArgs
    ) external payable override {
        bytes32 guildEnsNode = bytes(guildEnsName).namehash();
        bytes32 tagHash = bytes(tag).namehash();
        this.claimGuildTag(guildEnsNode, tagHash, recipient, extraClaimArgs);
    }

    function revokeGuildTag(string memory guildEnsName, string memory tag, bytes calldata extraData) external {
        bytes32 guildEnsNode = bytes(guildEnsName).namehash();
        bytes32 tagHash = bytes(tag).namehash();
        this.revokeGuildTag(guildEnsNode, tagHash, extraData);
    }

    function updateGuildFeePolicy(string memory guildEnsName, address feePolicy) external {
        bytes32 guildEnsNode = bytes(guildEnsName).namehash();
        this.updateGuildFeePolicy(guildEnsNode, feePolicy);
    }

    function updateGuildTagsAuthPolicy(string memory guildEnsName, address tagsAuthPolicy) external {
        bytes32 guildEnsNode = bytes(guildEnsName).namehash();
        this.updateGuildTagsAuthPolicy(guildEnsNode, tagsAuthPolicy);
    }

    function setGuildTokenUriTemplate(string memory guildEnsName, string calldata uriTemplate) external {
        bytes32 guildEnsNode = bytes(guildEnsName).namehash();
        this.setGuildTokenUriTemplate(guildEnsNode, uriTemplate);
    }

    function setGuildActive(string memory guildEnsName, bool active) external {
        bytes32 guildEnsNode = bytes(guildEnsName).namehash();
        this.setGuildActive(guildEnsNode, active);
    }

    function guildAdmin(string memory guildEnsName) external view returns (address) {
        bytes32 guildEnsNode = bytes(guildEnsName).namehash();
        return this.guildAdmin(guildEnsNode);
    }

    function transferGuildAdmin(string memory guildEnsName, address newAdmin) external {
        bytes32 guildEnsNode = bytes(guildEnsName).namehash();
        this.transferGuildAdmin(guildEnsNode, newAdmin);
    }
}
