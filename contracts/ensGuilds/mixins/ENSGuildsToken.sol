// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

abstract contract ENSGuildsToken is ERC1155 {
    using Counters for Counters.Counter;

    error GuildsTokenTransferNotAllowed();

    uint256 internal constant GUILD_ID_MASK = uint256(~uint128(0)) << 128;

    struct GuildTokenInfo {
        Counters.Counter tokenIdTracker;
        string templateURI;
        mapping(bytes32 => uint256) guildTagsToTokenIds;
    }

    // maps the top 128 bits of each guild's GuildID (ensNode) to its metadataURI and token ID counter
    mapping(bytes16 => GuildTokenInfo) private guilds;

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155) returns (bool) {
        return ERC1155.supportsInterface(interfaceId);
    }

    /**
     * @dev See {IERC1155MetadataURI-uri}.
     * @param tokenId The token whose URI is returned
     */
    function uri(uint256 tokenId) public view virtual override returns (string memory) {
        // calculate truncated guildHash from first 128 bits of tokenId
        uint256 truncatedGuildHashUint = tokenId & GUILD_ID_MASK;
        bytes16 truncatedGuildHash = bytes16(bytes32(truncatedGuildHashUint));

        // return guild-specific URI if exists
        string storage guildTemplateURI = guilds[truncatedGuildHash].templateURI;
        if (bytes(guildTemplateURI).length != 0) {
            return guildTemplateURI;
        }

        // return default URI shared by all guilds
        return ERC1155.uri(tokenId);
    }

    function _mintNewGuildToken(bytes32 guildHash, bytes32 tagHash, address to) internal {
        bytes16 truncatedGuildHash = bytes16(guildHash);

        uint256 tokenCounterCurrent = guilds[truncatedGuildHash].tokenIdTracker.current();
        require(tokenCounterCurrent < type(uint128).max, "tokenCounterOverflow");

        guilds[truncatedGuildHash].tokenIdTracker.increment();

        uint256 truncatedGuildHashUint = uint256(guildHash) & GUILD_ID_MASK;
        uint256 fullTokenId = truncatedGuildHashUint + tokenCounterCurrent;

        bytes memory emptyData;
        _mint(to, fullTokenId, 1, emptyData);

        guilds[truncatedGuildHash].guildTagsToTokenIds[tagHash] = fullTokenId;
    }

    function _burnGuildToken(bytes32 guildHash, bytes32 tagHash, address tagOwner) internal {
        bytes16 truncatedGuildHash = bytes16(guildHash);
        uint256 tokenId = guilds[truncatedGuildHash].guildTagsToTokenIds[tagHash];

        _burn(tagOwner, tokenId, 1);
    }

    function _setGuildTokenURITemplate(bytes32 guildHash, string calldata templateURI) internal {
        bytes16 truncatedGuildHash = bytes16(guildHash);
        guilds[truncatedGuildHash].templateURI = templateURI;
    }

    /**
     * @dev ENSGuilds NFTs are non-transferrable and may only be directly minted and burned
     * with their corresponding guild tags.
     */
    function safeTransferFrom(address, address, uint256, uint256, bytes memory) public virtual override {
        revert GuildsTokenTransferNotAllowed();
    }
}
