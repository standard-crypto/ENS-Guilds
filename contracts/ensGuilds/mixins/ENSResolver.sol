// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@ensdomains/ens-contracts/contracts/resolvers/profiles/IAddrResolver.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/IAddressResolver.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

abstract contract ENSResolver is IAddrResolver, IAddressResolver, ERC165 {
    uint256 private constant COIN_TYPE_ETH = 60;
    IAddressResolver private fallbackResolver;

    mapping(bytes32 => address) public addresses;

    constructor(IAddressResolver _fallbackResolver) {
        fallbackResolver = _fallbackResolver;
    }

    /**
     * Sets the address associated with an ENS node.
     * May only be called by descendants of this contract
     */
    function _setEnsForwardRecord(bytes32 node, address a) internal {
        addresses[node] = a;
    }

    function addr(bytes32 node) public view override returns (address payable) {
        bytes memory a = addr(node, COIN_TYPE_ETH);
        if (a.length == 0) {
            return payable(0);
        }
        return bytesToAddress(a);
    }

    function addr(bytes32 node, uint256 coinType) public view override returns (bytes memory) {
        address a = addresses[node];
        if (a == address(0)) {
            return fallbackResolver.addr(node, coinType);
        }
        return addressToBytes(a);
    }

    function supportsInterface(bytes4 interfaceID) public view virtual override(ERC165) returns (bool) {
        return
            interfaceID == type(IAddrResolver).interfaceId ||
            interfaceID == type(IAddressResolver).interfaceId ||
            super.supportsInterface(interfaceID);
    }

    // solhint-disable
    // Source: https://github.com/ensdomains/ens-contracts/blob/340a6d05cd00d078ae40edbc58c139eb7048189a/contracts/resolvers/profiles/AddrResolver.sol#L85
    function bytesToAddress(bytes memory b) internal pure returns (address payable a) {
        require(b.length == 20);
        assembly {
            a := div(mload(add(b, 32)), exp(256, 12)) // cspell:disable-line
        }
    }

    // Source: https://github.com/ensdomains/ens-contracts/blob/340a6d05cd00d078ae40edbc58c139eb7048189a/contracts/resolvers/profiles/AddrResolver.sol#L96
    function addressToBytes(address a) internal pure returns (bytes memory b) {
        b = new bytes(20);
        assembly {
            mstore(add(b, 32), mul(a, exp(256, 12))) // cspell:disable-line
        }
    }
    // solhint-enable
}
