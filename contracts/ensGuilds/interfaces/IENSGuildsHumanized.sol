// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IENSGuildsHumanized {
    function registerGuild(
        string memory ensName,
        address guildAdmin,
        address feePolicy,
        address tagsAuthPolicy
    ) external;

    function deregisterGuild(string memory guildEnsName) external;

    function claimGuildTag(
        string memory guildEnsName,
        string memory tag,
        address recipient,
        bytes calldata extraClaimArgs
    ) external payable;

    function transferGuildTag(
        string memory guildEnsName,
        string calldata tag,
        address recipient,
        bytes calldata extraTransferArgs
    ) external;

    function tagOwner(string memory guildEnsName, string memory tag) external view returns (address);

    function revokeGuildTag(string memory guildEnsName, string memory tag, bytes calldata extraData) external;

    function updateGuildFeePolicy(string memory guildEnsName, address feePolicy) external;

    function updateGuildTagsAuthPolicy(string memory guildEnsName, address tagsAuthPolicy) external;

    function setGuildTokenUriTemplate(string memory guildEnsName, string calldata uriTemplate) external;

    function setGuildActive(string memory guildEnsName, bool active) external;

    function guildAdmin(string memory guildEnsName) external view returns (address);

    function transferGuildAdmin(string memory guildEnsName, address newAdmin) external;
}
