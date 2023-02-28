// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

abstract contract ITagsAuthPolicy is ERC165 {
    function supportsInterface(bytes4 interfaceID) public view virtual override(ERC165) returns (bool) {
        return interfaceID == type(ITagsAuthPolicy).interfaceId || super.supportsInterface(interfaceID);
    }

    function canClaimTag(
        bytes32 guildHash,
        bytes32 tagHash,
        address claimant,
        address recipient,
        bytes calldata extraClaimArgs
    ) external virtual returns (bool);

    function onTagClaimed(
        bytes32 guildHash,
        bytes32 tagHash,
        address claimant,
        address recipient,
        bytes calldata extraClaimArgs
    ) external virtual returns (bytes32 tagToRevoke);

    function tagCanBeRevoked(
        bytes32 guildHash,
        bytes32 tagHash,
        bytes calldata extraRevokeArgs
    ) external virtual returns (bool);
}
