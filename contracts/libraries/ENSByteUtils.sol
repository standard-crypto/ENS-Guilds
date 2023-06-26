// SPDX-License-Identifier: MIT
// Source: https://github.com/ensdomains/ens-contracts/blob/340a6d05cd00d078ae40edbc58c139eb7048189a/contracts/resolvers/profiles/AddrResolver.sol

pragma solidity ^0.8.4;

/*
 * @dev Converts addresses to and from their bytestring represtations
 */
library ENSByteUtils {
    function toAddress(bytes memory b) internal pure returns (address payable a) {
        require(b.length == 20);
        assembly {
            a := div(mload(add(b, 32)), exp(256, 12)) // cspell:disable-line
        }
    }

    function toBytes(address a) internal pure returns (bytes memory b) {
        b = new bytes(20);
        assembly {
            mstore(add(b, 32), mul(a, exp(256, 12))) // cspell:disable-line
        }
    }
}
