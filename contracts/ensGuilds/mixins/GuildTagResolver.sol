// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@ensdomains/ens-contracts/contracts/resolvers/profiles/IAddrResolver.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/IAddressResolver.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "../../libraries/ENSByteUtils.sol";

abstract contract GuildTagResolver is IAddrResolver, IAddressResolver, ERC165 {
    using ENSByteUtils for address;
    using ENSByteUtils for bytes;

    uint256 private constant COIN_TYPE_ETH = 60;

    mapping(bytes32 => address) public addresses;

    /**
     * Sets the address associated with an ENS node.
     * May only be called by descendants of this contract
     */
    function _setEnsForwardRecord(bytes32 node, address a) internal {
        addresses[node] = a;
        emit AddrChanged(node, a);
        emit AddressChanged(node, COIN_TYPE_ETH, a.toBytes());
    }

    /**
     * @notice Returns the address associated with an ENS node.
     * @param node The ENS node to query.
     * @return The associated address.
     */
    function addr(bytes32 node) public view override returns (address payable) {
        bytes memory a = addr(node, COIN_TYPE_ETH);
        if (a.length == 0) {
            return payable(0);
        }
        return a.toAddress();
    }

    /**
     * @notice Returns the address associated with an ENS node.
     * @param node The ENS node to query.
     * @param coinType The coin type
     * @return The associated address.
     */
    function addr(bytes32 node, uint256 coinType) public view override returns (bytes memory) {
        bytes memory emptyBytes;

        if (coinType != COIN_TYPE_ETH) {
            return emptyBytes;
        }

        address a = addresses[node];
        if (a == address(0)) {
            return emptyBytes;
        }
        return a.toBytes();
    }

    function supportsInterface(bytes4 interfaceID) public view virtual override(ERC165) returns (bool) {
        return
            interfaceID == type(IAddrResolver).interfaceId ||
            interfaceID == type(IAddressResolver).interfaceId ||
            super.supportsInterface(interfaceID);
    }
}
