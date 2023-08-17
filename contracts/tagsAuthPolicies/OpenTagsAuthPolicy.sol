// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import { ReverseClaimer } from "@ensdomains/ens-contracts/contracts/reverseRegistrar/ReverseClaimer.sol";
import { ENS } from "@ensdomains/ens-contracts/contracts/registry/ENS.sol";
import { ERC165 } from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import { ITagsAuthPolicy } from "./ITagsAuthPolicy.sol";

contract OpenTagsAuthPolicy is ITagsAuthPolicy, ERC165, ReverseClaimer {
    function supportsInterface(bytes4 interfaceID) public view virtual override(IERC165, ERC165) returns (bool) {
        return interfaceID == type(ITagsAuthPolicy).interfaceId || super.supportsInterface(interfaceID);
    }

    // solhint-disable-next-line no-empty-blocks
    constructor(ENS _ensRegistry, address reverseRecordOwner) ReverseClaimer(_ensRegistry, reverseRecordOwner) {}

    function canClaimTag(
        bytes32,
        string calldata,
        address,
        address,
        bytes calldata
    ) external pure virtual override returns (bool) {
        return true;
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

    function canRevokeTag(
        address,
        bytes32,
        string calldata,
        bytes calldata
    ) external pure virtual override returns (bool) {
        return false;
    }

    function canTransferTag(
        bytes32,
        string calldata,
        address transferredBy,
        address currentOwner,
        address,
        bytes calldata
    ) external pure returns (bool) {
        return transferredBy == currentOwner;
    }

    function onTagRevoked(address, address, bytes32, string memory) external pure virtual override {
        return;
    }

    function onTagTransferred(bytes32, string calldata, address, address, address) external pure override {
        return;
    }
}
