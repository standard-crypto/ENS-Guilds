// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

abstract contract ENSGuildsToken is ERC1155 {
    using Counters for Counters.Counter;

    uint256 internal constant GUILD_ID_MASK = uint256(~uint128(0)) << 128;

    struct GuildTokenInfo {
        Counters.Counter tokenIdTracker;
        string templateURI;
    }

    mapping(bytes32 => GuildTokenInfo) private guilds;

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155) returns (bool) {
        return ERC1155.supportsInterface(interfaceId);
    }

    function uri(uint256 tokenId) public view virtual override returns (string memory) {
        // calculate guildHash from first 128 bits of tokenId
        uint256 guildId = tokenId & GUILD_ID_MASK;
        bytes32 guildHash = bytes32(guildId);

        // return guild-specific URI if exists
        string storage guildTemplateURI = guilds[guildHash].templateURI;
        if (bytes(guildTemplateURI).length != 0) {
            return guildTemplateURI;
        }

        // return default URI shared by all guilds
        return ERC1155.uri(tokenId);
    }

    function _mintNewGuildToken(bytes32 guildHash, address to) internal {
        uint256 tokenCounterCurrent = guilds[guildHash].tokenIdTracker.current();
        require(tokenCounterCurrent < type(uint128).max);

        guilds[guildHash].tokenIdTracker.increment();

        uint256 guildId = uint256(guildHash) & GUILD_ID_MASK;
        uint256 fullTokenId = guildId + tokenCounterCurrent;

        bytes memory emptyData;
        _mint(to, fullTokenId, 1, emptyData);
    }

    function _setGuildTokenURITemplate(bytes32 guildHash, string calldata templateURI) internal {
        guilds[guildHash].templateURI = templateURI;
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

    // TODO: helper view for calculating guild's token ID prefix?
}
