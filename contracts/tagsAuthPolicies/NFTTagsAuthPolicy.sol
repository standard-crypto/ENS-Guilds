// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";

import "./BaseTagsAuthPolicy.sol";

/**
 * @title NFTTagsAuthPolicy
 * @notice A common implementation of TagsAuthPolicy that can be used to restrict minting guild tags to only addresses
 * that own an NFT from a given collection, configured per-guild by each guild's admin. An address may mint a tag once
 * per each item in the collection that it owns. Minting two tags from the same TokenID will result in the first being
 * revoked once the second is minted, regardless of whether ownership of that TokenID has changed.
 *
 * A user's guild tag is eligible for revocation once that user ceases to own the TokenID used in minting that tag.
 */
contract NFTTagsAuthPolicy is BaseTagsAuthPolicy {
    using ERC165Checker for address;

    enum TokenStandard {
        ERC721,
        ERC1155
    }
    struct TagClaim {
        bytes32 tagHash;
        address claimedBy;
    }
    struct GuildInfo {
        address tokenContract;
        TokenStandard tokenStandard;
        mapping(uint256 => TagClaim) tagClaims;
    }
    mapping(bytes32 => GuildInfo) public guilds;

    constructor(IENSGuilds ensGuilds) BaseTagsAuthPolicy(ensGuilds) {}

    /**
     * @notice Registers the specific NFT collection that a user must be a member of to mint a guild tag
     * @param guildHash The ENS namehash of the guild's domain
     * @param tokenContract The ERC721 or ERC1155 collection to use
     */
    function setTokenContract(bytes32 guildHash, address tokenContract) external {
        // caller must be guild admin
        // solhint-disable-next-line reason-string
        require(_ensGuilds.guildAdmin(guildHash) == _msgSender());

        // token contract must be ERC721 or ERC1155
        if (tokenContract.supportsInterface(type(IERC721).interfaceId)) {
            guilds[guildHash].tokenStandard = TokenStandard.ERC721;
        } else if (tokenContract.supportsInterface(type(IERC1155).interfaceId)) {
            guilds[guildHash].tokenStandard = TokenStandard.ERC1155;
        } else {
            // solhint-disable-next-line reason-string
            revert();
        }

        guilds[guildHash].tokenContract = tokenContract;
    }

    /**
     * @inheritdoc ITagsAuthPolicy
     * @dev Expects that the caller will supply the NFT's TokenID in `extraClaimArgs`.
     * The caller must own the given TokenID.
     */
    function canClaimTag(
        bytes32 guildHash,
        bytes32,
        address claimant,
        address,
        bytes calldata extraClaimArgs
    ) external view virtual override returns (bool) {
        GuildInfo storage guildInfo = guilds[guildHash];
        address tokenContract = guildInfo.tokenContract;

        // parse NFT token ID from the tag claim args
        if (extraClaimArgs.length != 32) {
            return false;
        }
        uint256 nftTokenId = uint256(bytes32(extraClaimArgs));

        // check that claimant owns this NFT
        bool ownsNFT = false;
        if (guildInfo.tokenStandard == TokenStandard.ERC721) {
            ownsNFT = IERC721(tokenContract).ownerOf(nftTokenId) == claimant;
        } else {
            ownsNFT = IERC1155(tokenContract).balanceOf(claimant, nftTokenId) > 0;
        }
        if (!ownsNFT) {
            return false;
        }

        return true;
    }

    /**
     * @dev records the latest tag minted from the given TokenID (via extraClaimArgs), and returns whichever
     * tag was last minted from the same TokenID.
     */
    function _onTagClaimed(
        bytes32 guildHash,
        bytes32 tagHash,
        address claimant,
        address,
        bytes calldata extraClaimArgs
    ) internal virtual override returns (bytes32 tagToRevoke) {
        uint256 nftTokenId = uint256(bytes32(extraClaimArgs));

        tagToRevoke = guilds[guildHash].tagClaims[nftTokenId].tagHash;

        guilds[guildHash].tagClaims[nftTokenId].tagHash = tagHash;
        guilds[guildHash].tagClaims[nftTokenId].claimedBy = claimant;

        return tagToRevoke;
    }

    /**
     * @inheritdoc ITagsAuthPolicy
     */
    function tagCanBeRevoked(
        address,
        bytes32 guildHash,
        bytes32 tagHash,
        bytes calldata extraRevokeArgs
    ) external view virtual override returns (bool) {
        if (extraRevokeArgs.length != 32) {
            return false;
        }
        uint256 nftTokenId = uint256(bytes32(extraRevokeArgs));

        GuildInfo storage guildInfo = guilds[guildHash];
        address tokenContract = guildInfo.tokenContract;

        // check that the given tag was indeed claimed from the given NFT
        if (guildInfo.tagClaims[nftTokenId].tagHash != tagHash) {
            return false;
        }

        // check that the current owner of the given NFT is the same as the owner when the tag was claimed
        address previousClaimant = guildInfo.tagClaims[nftTokenId].claimedBy;
        if (guildInfo.tokenStandard == TokenStandard.ERC721) {
            address currentTokenOwner = IERC721(tokenContract).ownerOf(nftTokenId);
            return currentTokenOwner != previousClaimant;
        } else {
            return IERC1155(tokenContract).balanceOf(previousClaimant, nftTokenId) == 0;
        }
    }
}
