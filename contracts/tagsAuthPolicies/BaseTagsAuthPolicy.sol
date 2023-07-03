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

    IENSGuilds internal immutable _ensGuilds;

    constructor(IENSGuilds ensGuilds) {
        // solhint-disable-next-line reason-string
        require(ensGuilds.supportsInterface(type(IENSGuilds).interfaceId));
        _ensGuilds = ensGuilds;
    }

    modifier onlyEnsGuildsContract() {
        // caller must be guild admin
        // solhint-disable-next-line reason-string
        require(_msgSender() == address(_ensGuilds));
        _;
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
        bytes32 guildEnsNode,
        string calldata tag,
        address claimant,
        address recipient,
        bytes calldata extraClaimArgs
    ) external override nonReentrant onlyEnsGuildsContract returns (string memory tagToRevoke) {
        return _onTagClaimed(guildEnsNode, tag, claimant, recipient, extraClaimArgs);
    }

    /**
     * @dev entrypoint for implementations of BaseTagsAuthPolicy that need to update any state
     */
    function _onTagClaimed(
        bytes32 guildEnsNode,
        string calldata tag,
        address claimant,
        address recipient,
        bytes calldata extraClaimArgs
    ) internal virtual returns (string memory tagToRevoke);

    /**
     * @inheritdoc ITagsAuthPolicy
     * @dev protects against reentrancy and checks that caller is the Guilds contract. Updating any state
     * is deferred to the implementation.
     */
    function onTagRevoked(
        address revokedBy,
        address revokedFrom,
        bytes32 guildEnsNode,
        string memory tag
    ) external override nonReentrant onlyEnsGuildsContract {
        _onTagRevoked(revokedBy, revokedFrom, guildEnsNode, tag);
    }

    /**
     * @dev entrypoint for implementations of BaseTagsAuthPolicy that need to update any state
     */
    function _onTagRevoked(
        address revokedBy,
        address revokedFrom,
        bytes32 guildEnsNode,
        string memory tag
    ) internal virtual;

    /**
     * @inheritdoc ITagsAuthPolicy
     * @dev protects against reentrancy and checks that caller is the Guilds contract. Updating any state
     * is deferred to the implementation.
     */
    function onTagTransferred(
        bytes32 guildEnsNode,
        string calldata tag,
        address transferredBy,
        address prevOwner,
        address newOwner
    ) external override nonReentrant onlyEnsGuildsContract {
        _onTagTransferred(guildEnsNode, tag, transferredBy, prevOwner, newOwner);
    }

    /**
     * @dev entrypoint for implementations of BaseTagsAuthPolicy that need to update any state
     */
    function _onTagTransferred(
        bytes32 guildEnsNode,
        string calldata tag,
        address transferredBy,
        address prevOwner,
        address newOwner
    ) internal virtual;
}
