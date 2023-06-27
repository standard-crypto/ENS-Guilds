// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

import "./ITagsAuthPolicy.sol";

contract OpenTagsAuthPolicy is ITagsAuthPolicy, ERC165 {
    function supportsInterface(bytes4 interfaceID) public view virtual override(IERC165, ERC165) returns (bool) {
        return interfaceID == type(ITagsAuthPolicy).interfaceId || super.supportsInterface(interfaceID);
    }

    function canClaimTag(
        bytes32,
        string calldata,
        address,
        address,
        bytes calldata
    ) external view virtual override returns (bool) {
        return true;
    }

    function onTagClaimed(
        bytes32,
        string calldata,
        address,
        address,
        bytes calldata
    ) external virtual override returns (bytes32 tagToRevoke) {
        return 0;
    }

    function tagCanBeRevoked(
        address,
        bytes32,
        string calldata,
        bytes calldata
    ) external view virtual override returns (bool) {
        return false;
    }
}
