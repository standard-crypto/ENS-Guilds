// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@ensdomains/ens-contracts/contracts/registry/ENS.sol";
import "@ensdomains/ens-contracts/contracts/wrapper/INameWrapper.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/IExtendedResolver.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/utils/Context.sol";

import "../libraries/ENSParentName.sol";
import "../libraries/ENSByteUtils.sol";
import "../libraries/BytesLib.sol";
import "./PassthroughResolver.sol";

import "hardhat/console.sol";

abstract contract WildcardResolverBase is IExtendedResolver, Context, PassthroughResolver {
    using ENSByteUtils for address;
    using ENSByteUtils for bytes;
    using ENSParentName for bytes;
    using ERC165Checker for address;

    error RecordTypeNotSupported();
    error InvalidOperation();
    error OffchainLookup(address sender, string[] urls, bytes callData, bytes4 callbackFunction, bytes extraData);

    bytes4 public constant RESOLVER_SIGNATURE__ADDR = bytes4(keccak256(bytes("addr(bytes32)")));
    bytes4 public constant RESOLVER_SIGNATURE__ADDR_WITH_COINTYPE = bytes4(keccak256(bytes("addr(bytes32,uint256)")));
    bytes4 public constant RESOLVER_SIGNATURE__TEXT = bytes4(keccak256(bytes("text(bytes32,string)")));
    uint256 private constant COIN_TYPE_ETH = 60;

    ENS public immutable ensRegistry;
    INameWrapper public immutable ensNameWrapper;

    // dnsEncode(parentName) -> namehash(parentName)
    // ex: "test.eth" would be mapped as
    // 0x04746573740365746800 -> 0xeb4f647bea6caa36333c816d7b46fdcb05f9466ecacc140ea8c66faf15b3d9f1
    mapping(bytes => bytes32) internal parentEnsNodes;

    constructor(ENS _ensRegistry, INameWrapper _ensNameWrapper) {
        ensRegistry = _ensRegistry;
        ensNameWrapper = _ensNameWrapper;
    }

    function resolve(
        bytes calldata dnsEncodedName,
        bytes calldata resolverCalldata
    ) public view virtual override returns (bytes memory) {
        bytes4 resolverSignature = bytes4(resolverCalldata[:4]);

        if (resolverSignature == RESOLVER_SIGNATURE__ADDR) {
            address ethAddr = _resolveEthAddr(dnsEncodedName, resolverCalldata);
            return abi.encode(ethAddr);
        } else if (resolverSignature == RESOLVER_SIGNATURE__ADDR_WITH_COINTYPE) {
            (, uint256 coinType) = abi.decode(resolverCalldata[4:], (bytes32, uint256));
            if (coinType == COIN_TYPE_ETH) {
                address ethAddr = _resolveEthAddr(dnsEncodedName, resolverCalldata);
                return abi.encode(ethAddr.toBytes());
            } else {
                // Unsupported COIN_TYPE
                bytes memory emptyBytes;
                return abi.encode(emptyBytes);
            }
        } else if (resolverSignature == RESOLVER_SIGNATURE__TEXT) {
            string calldata key = _parseKeyFromCalldata(resolverCalldata);
            string memory result = _resolveTextRecord(dnsEncodedName, key, resolverCalldata);
            return abi.encode(result);
        }

        revert RecordTypeNotSupported();
    }

    function supportsInterface(bytes4 interfaceID) public view virtual override(PassthroughResolver) returns (bool) {
        return interfaceID == type(IExtendedResolver).interfaceId || PassthroughResolver.supportsInterface(interfaceID);
    }

    function _resolveWildcardEthAddr(
        bytes calldata childUtf8Encoded,
        bytes calldata parentDnsEncoded
    ) internal view virtual returns (address);

    function _resolveWildcardTextRecord(
        bytes calldata childUtf8Encoded,
        bytes calldata parentDnsEncoded,
        string calldata key
    ) internal view virtual returns (string memory);

    function _resolveEthAddr(
        bytes calldata dnsEncodedName,
        bytes calldata resolverCalldata
    ) private view returns (address result) {
        console.log("inside WildcardResolverBase _resolveEthAddr");
        // Check if the caller is asking for a record on the parent name itself (non-wildcard query)
        (bool isParentName, bytes32 ensNode) = _isParentName(dnsEncodedName);

        if (isParentName) {
            // Try to resolve the parent name using the two `addr()` resolver variants
            result = addr(ensNode);
            if (result == address(0)) {
                bytes memory addrBytes = addr(ensNode, COIN_TYPE_ETH);
                if (addrBytes.length != 0) {
                    result = addrBytes.toAddress();
                }
            }
        } else {
            // Caller has issued a wildcard query. Defer to the concrete implementation of this contract
            (bytes calldata childUtf8Encoded, bytes calldata parentDnsEncoded) = dnsEncodedName.splitParentChildNames();
            ensNode = parentEnsNodes[parentDnsEncoded];
            result = _resolveWildcardEthAddr(childUtf8Encoded, parentDnsEncoded);
        }

        // No luck. If our fallback resolver also happens to implement the `resolve()` wildcard standard then we can try
        // that as a final option
        address passthrough = getPassthroughTarget(ensNode);
        if (result == address(0) && passthrough.supportsInterface(type(IExtendedResolver).interfaceId)) {
            try IExtendedResolver(passthrough).resolve(dnsEncodedName, resolverCalldata) returns (
                bytes memory encodedResult
            ) {
                (result) = abi.decode(encodedResult, (address));
                // Catch OffchainLookup and override sender param
            } catch (bytes memory err) {
                // The first 4 bytes of the ABI encoded error represent the error's signature
                // Slice those 4 bytes and get the data from the OffchainLookup error
                (
                    address sender,
                    string[] memory urls,
                    bytes memory callData,
                    bytes4 callbackFunction,
                    bytes memory extraData
                ) = abi.decode(BytesLib.slice(err, 4, err.length - 4), (address, string[], bytes, bytes4, bytes));
                revert OffchainLookup(
                    address(this),
                    urls,
                    callData,
                    this.resolveCallback.selector,
                    abi.encode(sender, callbackFunction, extraData)
                );
            }
        }
    }

    // Callback to contract that initially reverted OffchainLookup
    function resolveCallback(bytes calldata response, bytes calldata extraData) public returns (bytes memory) {
        console.log("inside resolveCallback");
        (address inner, bytes4 innerCallbackFunction, bytes memory innerExtraData) = abi.decode(
            extraData,
            (address, bytes4, bytes)
        );
        (bool success, bytes memory data) = inner.call(
            abi.encodeWithSelector(innerCallbackFunction, response, innerExtraData)
        );
        if (success) {
            return abi.decode(data, (bytes));
        }
        revert InvalidOperation();
    }

    function _resolveTextRecord(
        bytes calldata dnsEncodedName,
        string calldata key,
        bytes calldata resolverCalldata
    ) private view returns (string memory result) {
        console.log("inside WildcardResolverBase _resolveTextRecord");
        // Check if the caller is asking for a record on the parent name itself (non-wildcard query)
        (bool isParentName, bytes32 ensNode) = _isParentName(dnsEncodedName);
        if (isParentName) {
            result = text(ensNode, key);
        } else {
            // Caller has issued a wildcard query. Defer to the concrete implementation of this contract
            (bytes calldata childUtf8Encoded, bytes calldata parentDnsEncoded) = dnsEncodedName.splitParentChildNames();
            ensNode = parentEnsNodes[parentDnsEncoded];
            result = _resolveWildcardTextRecord(childUtf8Encoded, parentDnsEncoded, key);
        }

        // No luck. If our fallback resolver also happens to implement the `resolve()` wildcard standard then we can try
        // that as a final option
        address passthrough = getPassthroughTarget(ensNode);
        if (bytes(result).length == 0 && passthrough.supportsInterface(type(IExtendedResolver).interfaceId)) {
            // bytes memory encodedResult = IExtendedResolver(passthrough).resolve(dnsEncodedName, resolverCalldata);
            try IExtendedResolver(passthrough).resolve(dnsEncodedName, resolverCalldata) returns (
                bytes memory encodedResult
            ) {
                (result) = abi.decode(encodedResult, (string));
                // Catch OffchainLookup and override sender param
            } catch (bytes memory err) {
                // The first 4 bytes of the ABI encoded error represent the error's signature
                // Slice those 4 bytes and get the data from the OffchainLookup error
                (
                    address sender,
                    string[] memory urls,
                    bytes memory callData,
                    bytes4 callbackFunction,
                    bytes memory extraData
                ) = abi.decode(BytesLib.slice(err, 4, err.length - 4), (address, string[], bytes, bytes4, bytes));
                revert OffchainLookup(
                    address(this),
                    urls,
                    callData,
                    this.resolveCallback.selector,
                    abi.encode(sender, callbackFunction, extraData)
                );
            }
        }
    }

    function _parseKeyFromCalldata(bytes calldata resolverCalldata) private pure returns (string calldata key) {
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

    function _isParentName(bytes calldata dnsEncodedName) internal view returns (bool, bytes32 ensNode) {
        ensNode = parentEnsNodes[dnsEncodedName];
        return (ensNode != bytes32(0), ensNode);
    }

    function _nodeOwner(bytes32 node) internal view returns (address) {
        address owner = ensRegistry.owner(node);
        if (owner == address(ensNameWrapper)) {
            owner = ensNameWrapper.ownerOf(uint256(node));
        }
        return owner;
    }
}
