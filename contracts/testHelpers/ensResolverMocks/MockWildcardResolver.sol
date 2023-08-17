// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import { ERC165 } from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import { ExtendedResolver } from "@ensdomains/ens-contracts/contracts/resolvers/profiles/ExtendedResolver.sol";
import { IExtendedResolver } from "@ensdomains/ens-contracts/contracts/resolvers/profiles/IExtendedResolver.sol";

contract MockWildcardResolver is ExtendedResolver, ERC165 {
    mapping(bytes32 => address) private addresses;
    mapping(bytes32 => mapping(string => string)) private texts;

    function supportsInterface(bytes4 interfaceID) public view override returns (bool) {
        return interfaceID == type(IExtendedResolver).interfaceId || super.supportsInterface(interfaceID);
    }

    function addr(bytes32 node) public view returns (address payable) {
        return payable(addresses[node]);
    }

    function setAddr(bytes32 node, address a) external {
        addresses[node] = a;
    }

    function setText(bytes32 node, string calldata key, string calldata value) external {
        texts[node][key] = value;
    }

    function text(bytes32 node, string calldata key) external view returns (string memory) {
        return texts[node][key];
    }
}
