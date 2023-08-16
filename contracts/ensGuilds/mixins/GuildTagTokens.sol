// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

abstract contract GuildTagTokens is ERC1155 {
    using Counters for Counters.Counter;

    error GuildsTokenTransferNotAllowed();

    struct GuildTokenInfo {
        string metadataUri;
    }

    // maps each guild's GuildID (ensNode) to its metadataURI
    mapping(bytes32 => GuildTokenInfo) private guilds;

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC1155) returns (bool) {
        return ERC1155.supportsInterface(interfaceId);
    }

    /**
     * @dev See {IERC1155MetadataURI-uri}.
     * @param tokenId The token whose URI is returned
     */
    function uri(uint256 tokenId) public view virtual override returns (string memory) {
        // return guild-specific URI if exists
        string storage guildMetadataURI = guilds[bytes32(tokenId)].metadataUri;
        if (bytes(guildMetadataURI).length != 0) {
            return guildMetadataURI;
        }

        // return default URI shared by all guilds
        return ERC1155.uri(tokenId);
    }

    function _mintNewGuildToken(bytes32 guildHash, address to) internal {
        _mint(to, uint256(guildHash), 1, "");
    }

    function _burnGuildToken(bytes32 guildHash, address tagOwner) internal {
        _burn(tagOwner, uint256(guildHash), 1);
    }

    function _transferGuildToken(bytes32 guildHash, address from, address to) internal {
        _safeTransferFrom(from, to, uint256(guildHash), 1, "");
    }

    function _setGuildTokenURI(bytes32 guildHash, string calldata metadataURI) internal {
        guilds[guildHash].metadataUri = metadataURI;
    }

    /**
     * @dev ENSGuilds NFTs are non-transferrable and may only be directly minted and burned
     * with their corresponding guild tags.
     */
    function safeTransferFrom(address, address, uint256, uint256, bytes memory) public virtual override {
        revert GuildsTokenTransferNotAllowed();
    }
}
