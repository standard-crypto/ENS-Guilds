// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "./TagsAuthPolicy.sol";

contract OpenTagsAuthPolicy is TagsAuthPolicy {
    function canClaimTag(bytes32, bytes32, address, address, bytes calldata) external virtual override returns (bool) {
        return true;
    }

    function onTagClaimed(
        bytes32,
        bytes32,
        address,
        address,
        bytes calldata
    ) external virtual override returns (bytes32 tagToRevoke) {
        return 0;
    }

    function tagCanBeRevoked(bytes32, bytes32, bytes calldata) external virtual override returns (bool) {
        return false;
    }
}
