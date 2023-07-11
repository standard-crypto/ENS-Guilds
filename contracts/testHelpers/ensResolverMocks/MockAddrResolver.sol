// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@ensdomains/ens-contracts/contracts/resolvers/profiles/AddrResolver.sol";

contract MockAddrResolver is AddrResolver {
    function isAuthorised(bytes32) internal pure override returns (bool) {
        return true;
    }

    function supportsInterface(bytes4 interfaceID) public view virtual override(AddrResolver) returns (bool) {
        return interfaceID == type(IAddrResolver).interfaceId || ERC165.supportsInterface(interfaceID);
    }
}
