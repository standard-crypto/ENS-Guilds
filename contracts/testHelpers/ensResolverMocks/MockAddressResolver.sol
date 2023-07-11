// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@ensdomains/ens-contracts/contracts/resolvers/profiles/AddrResolver.sol";

contract MockAddressResolver is AddrResolver {
    function addr(bytes32 node) public view override returns (address payable) {
        return super.addr(node);
    }

    function isAuthorised(bytes32) internal pure override returns (bool) {
        return true;
    }

    function supportsInterface(bytes4 interfaceID) public view override(AddrResolver) returns (bool) {
        return interfaceID == type(IAddressResolver).interfaceId || ERC165.supportsInterface(interfaceID);
    }
}
