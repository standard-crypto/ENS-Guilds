// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@ensdomains/ens-contracts/contracts/resolvers/profiles/IExtendedResolver.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "../libraries/ENSParentName.sol";

contract Erc721WildcardResolver is IExtendedResolver, ERC165 {
    using ENSParentName for bytes;
    using ERC165Checker for address;

    // parentName -> address
    mapping(bytes => IERC721) public tokens;

    // TODO: requires auth, or should be abstract function
    function setTokenContract(bytes calldata ensName, address tokenContract) external {
        require(tokenContract.supportsInterface(type(IERC721).interfaceId));
        tokens[ensName] = IERC721(tokenContract);
    }

    function resolve(bytes calldata name, bytes calldata data) public view override returns (bytes memory) {
        bytes memory emptyBytes;

        // TODO: check the `data` param equals ABI encoding of addr(namehash(name))

        (bytes calldata child, bytes calldata parent) = name.splitParentChildNames();

        IERC721 tokenContract = tokens[parent];

        // No NFT contract registered for this address
        if (address(tokenContract) == address(0)) {
            return emptyBytes;
        }

        // Extract tokenId from child name
        (bool valid, uint256 tokenId) = _parseTokenIdFromName(child);
        if (!valid) {
            return emptyBytes;
        }
        address tokenOwner = tokenContract.ownerOf(tokenId);
        return addressToBytes(tokenOwner);
    }

    function supportsInterface(bytes4 interfaceID) public view virtual override(ERC165) returns (bool) {
        return interfaceID == type(IExtendedResolver).interfaceId || super.supportsInterface(interfaceID);
    }

    // solhint-disable
    // Source: https://github.com/ensdomains/ens-contracts/blob/340a6d05cd00d078ae40edbc58c139eb7048189a/contracts/resolvers/profiles/AddrResolver.sol#L96
    function addressToBytes(address a) internal pure returns (bytes memory b) {
        b = new bytes(20);
        assembly {
            mstore(add(b, 32), mul(a, exp(256, 12))) // cspell:disable-line
        }
    }

    // solhint-enable

    // TODO: move to separate library and unit test
    function _parseTokenIdFromName(bytes calldata name) internal pure returns (bool valid, uint256 tokenId) {
        uint i;
        tokenId = 0;
        for (i = 0; i < name.length; i++) {
            if (name[i] < bytes1(0x30) || name[i] > bytes1(0x39)) {
                return (false, 0);
            }
            uint c = uint(uint8(name[i])) - 48;
            tokenId = tokenId * 10 + c;
        }
        return (true, tokenId);
    }
}
