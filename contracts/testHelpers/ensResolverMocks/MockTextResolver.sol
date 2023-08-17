// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import { TextResolver } from "@ensdomains/ens-contracts/contracts/resolvers/profiles/TextResolver.sol";

contract MockTextResolver is TextResolver {
    function isAuthorised(bytes32) internal pure override returns (bool) {
        return true;
    }
}
