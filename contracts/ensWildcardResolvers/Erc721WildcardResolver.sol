// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@ensdomains/ens-contracts/contracts/resolvers/profiles/IExtendedResolver.sol";
import "@ensdomains/ens-contracts/contracts/utils/NameEncoder.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "../libraries/ENSParentName.sol";

contract Erc721WildcardResolver is IExtendedResolver, ERC165 {
    using ENSParentName for bytes;
    using ERC165Checker for address;
    using NameEncoder for string;
    using Strings for string;
    using Strings for address;
    using Strings for uint256;

    error RecordTypeNotSupported();

    bytes4 public constant RESOLVER_SIGNATURE__ADDR = bytes4(keccak256(bytes("addr(bytes32)")));
    bytes4 public constant RESOLVER_SIGNATURE__ADDR_WITH_COINTYPE = bytes4(keccak256(bytes("addr(bytes32,uint256)")));
    bytes4 public constant RESOLVER_SIGNATURE__TEXT = bytes4(keccak256(bytes("text(bytes32,string)")));

    uint256 private constant COIN_TYPE_ETH = 60;

    // dnsEncode(parentName) -> address
    // ex: key for "test.eth" is `0x04746573740365746800`
    mapping(bytes => IERC721) public tokens;

    // TODO: requires auth, or should be abstract function
    function setTokenContract(string calldata ensName, address tokenContract) external {
        require(tokenContract.supportsInterface(type(IERC721).interfaceId), "Does not implement ERC721");
        (bytes memory encodedName, ) = ensName.dnsEncodeName();
        tokens[encodedName] = IERC721(tokenContract);
    }

    function resolve(bytes calldata name, bytes calldata data) public view override returns (bytes memory) {
        bytes4 resolutionFunction = bytes4(data[:4]);

        if (resolutionFunction == RESOLVER_SIGNATURE__ADDR) {
            address tokenOwner = _resolveEthAddr(name);
            return abi.encode(tokenOwner);
        } else if (resolutionFunction == RESOLVER_SIGNATURE__ADDR_WITH_COINTYPE) {
            (, uint256 coinType) = abi.decode(data[4:], (bytes32, uint256));
            if (coinType == COIN_TYPE_ETH) {
                address tokenOwner = _resolveEthAddr(name);
                return abi.encode(addressToBytes(tokenOwner));
            } else {
                // Unsupported COIN_TYPE
                bytes memory emptyBytes;
                return abi.encode(emptyBytes);
            }
        } else if (resolutionFunction == RESOLVER_SIGNATURE__TEXT) {
            (, string memory key) = abi.decode(data[4:], (bytes32, string));
            string memory result = _resolveTextRecord(name, key);
            return abi.encode(result);
        }

        revert RecordTypeNotSupported();
    }

    function supportsInterface(bytes4 interfaceID) public view virtual override(ERC165) returns (bool) {
        return interfaceID == type(IExtendedResolver).interfaceId || super.supportsInterface(interfaceID);
    }

    function _resolveEthAddr(bytes calldata name) private view returns (address) {
        (bytes calldata childUtf8Encoded, bytes calldata parentDnsEncoded) = name.splitParentChildNames();

        IERC721 tokenContract = tokens[parentDnsEncoded];

        // No NFT contract registered for this address
        if (address(tokenContract) == address(0)) {
            return address(0);
        }

        // Extract tokenId from child name
        (bool valid, uint256 tokenId) = _parseTokenIdFromName(childUtf8Encoded);
        if (!valid) {
            return address(0);
        }

        // Lookup token owner
        address tokenOwner;
        try tokenContract.ownerOf(tokenId) returns (address _tokenOwner) {
            tokenOwner = _tokenOwner;
        } catch {
            tokenOwner = address(0);
        }
        return tokenOwner;
    }

    function _resolveTextRecord(bytes calldata name, string memory key) private view returns (string memory) {
        (bytes calldata childUtf8Encoded, bytes calldata parentDnsEncoded) = name.splitParentChildNames();

        IERC721 tokenContract = tokens[parentDnsEncoded];

        // No NFT contract registered for this address
        if (address(tokenContract) == address(0)) {
            return "";
        }

        // Extract tokenId from child name
        (bool valid, uint256 tokenId) = _parseTokenIdFromName(childUtf8Encoded);
        if (!valid) {
            return "";
        }

        // Don't bother returning anything if this tokenId has never been minted
        // solhint-disable-next-line no-empty-blocks
        try tokenContract.ownerOf(tokenId) {} catch {
            return "";
        }

        if (key.equal("avatar")) {
            // Standard described here:
            // https://docs.ens.domains/ens-improvement-proposals/ensip-12-avatar-text-records
            return string.concat("eip155:1/erc721:", address(tokenContract).toHexString(), "/", tokenId.toString());
        }

        // unsupported key
        return "";
    }

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

    // solhint-disable
    // Source: https://github.com/ensdomains/ens-contracts/blob/340a6d05cd00d078ae40edbc58c139eb7048189a/contracts/resolvers/profiles/AddrResolver.sol#L96
    function addressToBytes(address a) internal pure returns (bytes memory b) {
        b = new bytes(20);
        assembly {
            mstore(add(b, 32), mul(a, exp(256, 12))) // cspell:disable-line
        }
    }
    // solhint-enable
}
