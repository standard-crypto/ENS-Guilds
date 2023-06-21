// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

import "./ITagsAuthPolicy.sol";
import "../ensGuilds/interfaces/IENSGuilds.sol";

/**
 * @title BaseTagsAuthPolicy
 * @notice An base implementation of ITagsAuthPolicy
 */
abstract contract BaseTagsAuthPolicy is ITagsAuthPolicy, ERC165, Context, ReentrancyGuard {
    using ERC165Checker for address;

    IENSGuilds internal _ensGuilds;

    constructor(IENSGuilds ensGuilds) {
        // solhint-disable-next-line reason-string
        require(ensGuilds.supportsInterface(type(IENSGuilds).interfaceId));
        _ensGuilds = ensGuilds;
    }

    function supportsInterface(bytes4 interfaceID) public view virtual override(IERC165, ERC165) returns (bool) {
        return interfaceID == type(ITagsAuthPolicy).interfaceId || super.supportsInterface(interfaceID);
    }

    /**
     * @inheritdoc ITagsAuthPolicy
     * @dev protects against reentrancy and checks that caller is the Guilds contract. Updating any state
     * is deferred to the implementation.
     */
    function onTagClaimed(
        bytes32 guildHash,
        bytes32 tagHash,
        address claimant,
        address recipient,
        bytes calldata extraClaimArgs
    ) external override nonReentrant returns (bytes32 tagToRevoke) {
        // caller must be guild admin
        // solhint-disable-next-line reason-string
        require(_msgSender() == address(_ensGuilds));

        return _onTagClaimed(guildHash, tagHash, claimant, recipient, extraClaimArgs);
    }

    /**
     * @dev entrypoint for implementations of BaseTagsAuthPolicy that need to update any state
     */
    function _onTagClaimed(
        bytes32 guildHash,
        bytes32 tagHash,
        address claimant,
        address recipient,
        bytes calldata extraClaimArgs
    ) internal virtual returns (bytes32 tagToRevoke);
}
