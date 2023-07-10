// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@ensdomains/ens-contracts/contracts/resolvers/profiles/IExtendedResolver.sol";
import "@ensdomains/ens-contracts/contracts/utils/NameEncoder.sol";
import "@ensdomains/ens-contracts/contracts/registry/ENS.sol";
import "@ensdomains/ens-contracts/contracts/wrapper/INameWrapper.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import "../libraries/ENSByteUtils.sol";
import "../libraries/ENSParentName.sol";
import "../libraries/ENSNamehash.sol";
import "../libraries/StringParsing.sol";
import "./PassthroughResolver.sol";

contract Erc721WildcardResolver is Context, PassthroughResolver, IExtendedResolver {
    using ENSParentName for bytes;
    using ENSNamehash for bytes;
    using ENSByteUtils for address;
    using ERC165Checker for address;
    using NameEncoder for string;
    using StringParsing for bytes;
    using Strings for string;
    using Strings for address;
    using Strings for uint256;

    error RecordTypeNotSupported();
    error CallerNotAuthorised();
    error InvalidTokenContract();

    bytes4 public constant RESOLVER_SIGNATURE__ADDR = bytes4(keccak256(bytes("addr(bytes32)")));
    bytes4 public constant RESOLVER_SIGNATURE__ADDR_WITH_COINTYPE = bytes4(keccak256(bytes("addr(bytes32,uint256)")));
    bytes4 public constant RESOLVER_SIGNATURE__TEXT = bytes4(keccak256(bytes("text(bytes32,string)")));

    uint256 private constant COIN_TYPE_ETH = 60;

    ENS public immutable ens;
    INameWrapper public immutable nameWrapper;

    // dnsEncode(parentName) -> address
    // ex: key for "test.eth" is `0x04746573740365746800`
    mapping(bytes => IERC721) public tokens;

    // dnsEncode(parentName) -> namehash(parentName)
    // ex: "test.eth" would be mapped as
    // 0x04746573740365746800 -> 0xeb4f647bea6caa36333c816d7b46fdcb05f9466ecacc140ea8c66faf15b3d9f1
    mapping(bytes => bytes32) public parentEnsNodes;

    // mapping of namehash(parentName) to set of addresses authorized to set records on the parent
    mapping(bytes32 => mapping(address => bool)) public approvedDelegates;

    constructor(ENS _ens, INameWrapper wrapperAddress) {
        ens = _ens;
        nameWrapper = wrapperAddress;
    }

    function setTokenContract(
        string calldata ensName,
        address tokenContract,
        IPublicResolver fallbackResolver
    ) external {
        // Must have provided valid ERC721 contract
        if (!tokenContract.supportsInterface(type(IERC721).interfaceId)) {
            revert InvalidTokenContract();
        }

        (bytes memory encodedName, bytes32 ensNode) = ensName.dnsEncodeName();

        // Caller must be the name owner or a delegate of the name owner
        if (!isAuthorised(ensNode)) {
            revert CallerNotAuthorised();
        }

        tokens[encodedName] = IERC721(tokenContract);
        parentEnsNodes[encodedName] = ensNode;
        passthroughTargets[ensNode] = fallbackResolver;
    }

    function isAuthorised(bytes32 node) internal view virtual override returns (bool) {
        address owner = _nodeOwner(node);
        address sender = _msgSender();
        return sender == owner || isApprovedFor(owner, node, sender);
    }

    function isApprovedFor(address, bytes32 node, address delegate) public view returns (bool) {
        return approvedDelegates[node][delegate];
    }

    function setApprovedFor(bytes32 node, address delegate, bool approved) external {
        if (_msgSender() != _nodeOwner(node)) {
            revert CallerNotAuthorised();
        }
        approvedDelegates[node][delegate] = approved;
    }

    function resolve(
        bytes calldata dnsEncodedName,
        bytes calldata resolverCalldata
    ) public view override returns (bytes memory) {
        bytes4 resolverSignature = bytes4(resolverCalldata[:4]);

        if (resolverSignature == RESOLVER_SIGNATURE__ADDR) {
            address tokenOwner = _resolveEthAddr(dnsEncodedName);
            return abi.encode(tokenOwner);
        } else if (resolverSignature == RESOLVER_SIGNATURE__ADDR_WITH_COINTYPE) {
            (, uint256 coinType) = abi.decode(resolverCalldata[4:], (bytes32, uint256));
            if (coinType == COIN_TYPE_ETH) {
                address tokenOwner = _resolveEthAddr(dnsEncodedName);
                return abi.encode(tokenOwner.toBytes());
            } else {
                // Unsupported COIN_TYPE
                bytes memory emptyBytes;
                return abi.encode(emptyBytes);
            }
        } else if (resolverSignature == RESOLVER_SIGNATURE__TEXT) {
            string calldata key = _parseKeyFromCalldata(resolverCalldata);
            string memory result = _resolveTextRecord(dnsEncodedName, key);
            return abi.encode(result);
        }

        revert RecordTypeNotSupported();
    }

    function supportsInterface(bytes4 interfaceID) public view virtual override(PassthroughResolver) returns (bool) {
        return interfaceID == type(IExtendedResolver).interfaceId || PassthroughResolver.supportsInterface(interfaceID);
    }

    function _resolveEthAddr(bytes calldata dnsEncodedName) private view returns (address) {
        // Check if the caller is asking for a record on the parent name itself (non-wildcard query)
        (bool isParentName, bytes32 ensNode) = _isParentName(dnsEncodedName);
        if (isParentName) {
            return addr(ensNode);
        }

        // Caller has issued a wildcard query
        (bytes calldata childUtf8Encoded, bytes calldata parentDnsEncoded) = dnsEncodedName.splitParentChildNames();

        IERC721 tokenContract = tokens[parentDnsEncoded];

        // No NFT contract registered for this address
        if (address(tokenContract) == address(0)) {
            return address(0);
        }

        // Extract tokenId from child name
        (bool valid, uint256 tokenId) = childUtf8Encoded.parseUint256();
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

    function _resolveTextRecord(
        bytes calldata dnsEncodedName,
        string calldata key
    ) private view returns (string memory) {
        // Check if the caller is asking for a record on the parent name itself (non-wildcard query)
        (bool isParentName, bytes32 ensNode) = _isParentName(dnsEncodedName);
        if (isParentName) {
            return text(ensNode, key);
        }

        (bytes calldata childUtf8Encoded, bytes calldata parentDnsEncoded) = dnsEncodedName.splitParentChildNames();

        IERC721 tokenContract = tokens[parentDnsEncoded];

        // No NFT contract registered for this address
        if (address(tokenContract) == address(0)) {
            return "";
        }

        // Extract tokenId from child name
        (bool valid, uint256 tokenId) = childUtf8Encoded.parseUint256();
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
        } else if (key.equal("url")) {
            string memory url;
            try IERC721Metadata(address(tokenContract)).tokenURI(tokenId) returns (string memory _url) {
                url = _url;
            } catch {
                url = "";
            }
            return url;
        }

        // unsupported key
        return "";
    }

    function _isParentName(bytes calldata dnsEncodedName) internal view returns (bool, bytes32 ensNode) {
        ensNode = parentEnsNodes[dnsEncodedName];
        return (ensNode != bytes32(0), ensNode);
    }

    function _parseKeyFromCalldata(bytes calldata resolverCalldata) internal pure returns (string calldata key) {
        // ENS resolvers expect that the `key` for text queries is passed in via calldata.
        //
        // Until this is implemented in Solidity, we have to hand-pick the string out
        // of the calldata ourself: https://github.com/ethereum/solidity/issues/13518
        //
        // Here's the cleaner version once the above is implemented:
        //    (, string calldata key) = abi.decode(resolverCalldata[4:], (bytes32, string calldata));
        //
        // Reminder: the text resolver signature is `text(bytes32 ensNode, string [calldata] key)`
        //
        // Offset math:
        //    - 4 bytes for the function selector for `text(bytes32,string)`
        //    - 32 bytes for the `ensNode` as bytes32
        //    - 32 bytes to encode the offset to start of data part of the dynamic string parameter
        //         (see https://docs.soliditylang.org/en/v0.8.20/abi-spec.html#use-of-dynamic-types)
        //    - 32 bytes for the string's length: uint256(len(bytes(key_as_utf8_string)))
        //    - Remainder is the UTF8 encoding of the key, right-padded to a multiple of 32 bytes
        uint256 keyLengthOffset = 4 + 32 + 32;
        uint256 keyOffset = keyLengthOffset + 32;

        uint256 keyLength = abi.decode(resolverCalldata[keyLengthOffset:], (uint256));

        key = string(resolverCalldata[keyOffset:keyOffset + keyLength]);
    }

    function _nodeOwner(bytes32 node) internal view returns (address) {
        address owner = ens.owner(node);
        if (owner == address(nameWrapper)) {
            owner = nameWrapper.ownerOf(uint256(node));
        }
        return owner;
    }
}
