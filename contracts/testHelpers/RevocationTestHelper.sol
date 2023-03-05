// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../tagsAuthPolicies/TagsAuthPolicy.sol";

contract RevocationTestHelper is TagsAuthPolicy {
    bytes32 private _onTagClaimedRetVal;
    bool private _tagCanBeRevokedRetVal = true;

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
        return _onTagClaimedRetVal;
    }

    function tagCanBeRevoked(bytes32, bytes32, bytes calldata) external virtual override returns (bool) {
        return _tagCanBeRevokedRetVal;
    }

    function stub_tagCanBeRevokedReturnVal(bool retVal) external {
        _tagCanBeRevokedRetVal = retVal;
    }

    function stub_onTagClaimedReturnVal(bytes32 retVal) external {
        _onTagClaimedRetVal = retVal;
    }
}
