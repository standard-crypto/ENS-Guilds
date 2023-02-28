// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../../tagsAuthPolicies/TagsAuthPolicy.sol";
import "./IClaimGuildTagReentrancyAttacker.sol";

/**
 * ReentrancyAttackAuthPolicy is a dummy TagsAuthPolicy that includes logic in
 * its `canClaimTag` implementation that calls out to a function on a
 * separate contract.
 *
 * That separate contract exposes an apparently benign lookup function that
 * will re-invoke `claimGuildTag`.
 */
contract ReentrancyAttackAuthPolicy is TagsAuthPolicy {
    IClaimGuildTagReentrancyAttacker private attacker;

    constructor(IClaimGuildTagReentrancyAttacker _attacker) {
        attacker = _attacker;
    }

    function canClaimTag(bytes32, bytes32, address, address, bytes calldata) external virtual override returns (bool) {
        bool canMint = attacker.insidiousLookupFunction();
        return canMint;
    }

    function onTagClaimed(
        bytes32,
        bytes32,
        address,
        address,
        bytes calldata
    ) external virtual override returns (bytes32 tagToRevoke) {
        return bytes32(0);
    }

    function tagCanBeRevoked(bytes32, bytes32, bytes calldata) external virtual override returns (bool) {
        return false;
    }
}
