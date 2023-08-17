// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import { ERC165 } from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import { ITagsAuthPolicy } from "../../tagsAuthPolicies/ITagsAuthPolicy.sol";
import { IClaimGuildTagReentrancyAttacker } from "./IClaimGuildTagReentrancyAttacker.sol";

/**
 * ReentrancyAttackAuthPolicy is a dummy TagsAuthPolicy that includes logic in
 * its `canClaimTag` implementation that calls out to a function on a
 * separate contract.
 *
 * That separate contract exposes an apparently benign lookup function that
 * will re-invoke `claimGuildTag`.
 */
contract ReentrancyAttackAuthPolicy is ITagsAuthPolicy, ERC165 {
    IClaimGuildTagReentrancyAttacker private immutable attacker;

    constructor(IClaimGuildTagReentrancyAttacker _attacker) {
        attacker = _attacker;
    }

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
        bool canMint = attacker.insidiousLookupFunction();
        return canMint;
    }

    function onTagClaimed(
        bytes32,
        string calldata,
        address,
        address,
        bytes calldata
    ) external virtual override returns (string memory tagToRevoke) {
        return "";
    }

    function canTransferTag(
        bytes32,
        string calldata,
        address,
        address,
        address,
        bytes calldata
    ) external pure override returns (bool) {
        return false;
    }

    function onTagTransferred(bytes32, string calldata, address, address, address) external pure override {
        return;
    }

    function canRevokeTag(
        address,
        bytes32,
        string calldata,
        bytes calldata
    ) external view virtual override returns (bool) {
        return false;
    }

    function onTagRevoked(address, address, bytes32, string memory) external virtual override {
        return;
    }
}
