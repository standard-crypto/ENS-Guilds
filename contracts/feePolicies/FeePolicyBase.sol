// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import { ERC165 } from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

import { IFeePolicy } from "./IFeePolicy.sol";

abstract contract FeePolicyBase is ERC165, IFeePolicy {
    function supportsInterface(bytes4 interfaceID) public view virtual override(ERC165, IERC165) returns (bool) {
        return interfaceID == type(IFeePolicy).interfaceId || super.supportsInterface(interfaceID);
    }
}
