// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Context.sol";

import "./TagsAuthPolicy.sol";
import "../ensGuilds/interfaces/IENSGuilds.sol";

contract AllowlistTagsAuthPolicy is Context, TagsAuthPolicy, ReentrancyGuard {
    using ERC165Checker for address;

    IENSGuilds private ensGuilds;

    mapping(bytes32 => mapping(address => bool)) public guildAllowlists;

    constructor(address _ensGuilds) {
        // solhint-disable-next-line reason-string
        require(_ensGuilds.supportsInterface(type(IENSGuilds).interfaceId));
        ensGuilds = IENSGuilds(_ensGuilds);
    }

    function allowMint(bytes32 guildHash, address minter) external {
        // caller must be guild admin
        // solhint-disable-next-line reason-string
        require(ensGuilds.guildAdmin(guildHash) == _msgSender());
        guildAllowlists[guildHash][minter] = true;
    }

    function canClaimTag(
        bytes32 guildHash,
        bytes32,
        address claimant,
        address,
        bytes calldata
    ) external virtual override returns (bool) {
        return guildAllowlists[guildHash][claimant];
    }

    function onTagClaimed(
        bytes32 guildHash,
        bytes32,
        address claimant,
        address,
        bytes calldata
    ) external virtual override nonReentrant returns (bytes32 tagToRevoke) {
        // Caller must be ENSGuilds contract
        // solhint-disable-next-line reason-string
        require(_msgSender() == address(ensGuilds));

        guildAllowlists[guildHash][claimant] = false;
        return 0;
    }

    function tagCanBeRevoked(bytes32, bytes32, bytes calldata) external virtual override returns (bool) {
        return false;
    }
}
