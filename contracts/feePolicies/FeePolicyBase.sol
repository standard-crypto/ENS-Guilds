// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "./IFeePolicy.sol";

abstract contract FeePolicyBase is ERC165, IFeePolicy {
    function supportsInterface(bytes4 interfaceID) public view virtual override(ERC165) returns (bool) {
        return interfaceID == type(IFeePolicy).interfaceId || super.supportsInterface(interfaceID);
    }
}
