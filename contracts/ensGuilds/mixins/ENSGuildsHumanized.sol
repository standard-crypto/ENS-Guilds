// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../interfaces/IENSGuilds.sol";
import "../interfaces/IENSGuildsHumanized.sol";
import "../../libraries/ENSNamehash.sol";

abstract contract ENSGuildsHumanized is IENSGuildsHumanized {
    using ENSNamehash for bytes;

    // Humanized versions

    function registerGuild(
        string memory ensName,
        address admin,
        address feePolicy,
        address tagsAuthPolicy
    ) external override {
        bytes32 ensNode = bytes(ensName).namehash();
        registerGuild(ensNode, admin, feePolicy, tagsAuthPolicy);
    }

    function deregisterGuild(string memory guildEnsName) external {
        bytes32 guildEnsNode = bytes(guildEnsName).namehash();
        deregisterGuild(guildEnsNode);
    }

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

    function revokeGuildTag(string memory guildEnsName, string memory tag, bytes calldata extraData) external {
        bytes32 guildEnsNode = bytes(guildEnsName).namehash();
        bytes32 tagHash = keccak256(bytes(tag));
        revokeGuildTag(guildEnsNode, tagHash, extraData);
    }

    function tagOwner(string memory guildEnsName, string memory tag) external view returns (address) {
        bytes32 guildEnsNode = bytes(guildEnsName).namehash();
        bytes32 tagHash = keccak256(bytes(tag));
        return tagOwner(guildEnsNode, tagHash);
    }

    function updateGuildFeePolicy(string memory guildEnsName, address feePolicy) external {
        bytes32 guildEnsNode = bytes(guildEnsName).namehash();
        updateGuildFeePolicy(guildEnsNode, feePolicy);
    }

    function updateGuildTagsAuthPolicy(string memory guildEnsName, address tagsAuthPolicy) external {
        bytes32 guildEnsNode = bytes(guildEnsName).namehash();
        updateGuildTagsAuthPolicy(guildEnsNode, tagsAuthPolicy);
    }

    function setGuildTokenUriTemplate(string memory guildEnsName, string calldata uriTemplate) external {
        bytes32 guildEnsNode = bytes(guildEnsName).namehash();
        setGuildTokenUriTemplate(guildEnsNode, uriTemplate);
    }

    function setGuildActive(string memory guildEnsName, bool active) external {
        bytes32 guildEnsNode = bytes(guildEnsName).namehash();
        setGuildActive(guildEnsNode, active);
    }

    function guildAdmin(string memory guildEnsName) external view returns (address) {
        bytes32 guildEnsNode = bytes(guildEnsName).namehash();
        return guildAdmin(guildEnsNode);
    }

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
