// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import { ENSParentName } from "../libraries/ENSParentName.sol";

contract ENSParentNameTestHelper {
    using ENSParentName for bytes;

    function splitParentChildNames(
        bytes calldata name
    ) external pure returns (bytes calldata child, bytes calldata parent) {
        return name.splitParentChildNames();
    }
}
