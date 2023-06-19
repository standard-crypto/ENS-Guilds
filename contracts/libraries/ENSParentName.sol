// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

/*
 * @dev Finds the parent name of a given ENS name, or the empty string if there is no parent.
 * Note: Library assumes the given name is already a well-formed ENS name, and does not check for invalid input.
 */
library ENSParentName {
    function splitParentChildNames(
        bytes calldata name
    ) internal pure returns (bytes calldata child, bytes calldata parent) {
        uint256 length = name.length;
        for (uint256 i = 0; i < length; i++) {
            if (name[i] == ".") {
                return (name[0:i], name[i + 1:length]);
            }
        }
        return (name[:length], name[length:]);
    }
}
