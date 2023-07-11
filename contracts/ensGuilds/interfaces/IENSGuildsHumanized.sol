// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

interface IENSGuildsHumanized {
    function deregisterGuild(string calldata guildEnsName) external;

    function claimGuildTag(
        string calldata guildEnsName,
        string calldata tag,
        address recipient,
        bytes calldata extraClaimArgs
    ) external payable;

    function transferGuildTag(
        string calldata guildEnsName,
        string calldata tag,
        address recipient,
        bytes calldata extraTransferArgs
    ) external;

    function tagOwner(string memory guildEnsName, string memory tag) external view returns (address);

    function revokeGuildTag(string calldata guildEnsName, string calldata tag, bytes calldata extraData) external;

    function updateGuildFeePolicy(string calldata guildEnsName, address feePolicy) external;

    function updateGuildTagsAuthPolicy(string calldata guildEnsName, address tagsAuthPolicy) external;

    function setGuildTokenUriTemplate(string calldata guildEnsName, string calldata uriTemplate) external;

    function setGuildActive(string calldata guildEnsName, bool active) external;

    function guildAdmin(string memory guildEnsName) external view returns (address);

    function transferGuildAdmin(string calldata guildEnsName, address newAdmin) external;
}
