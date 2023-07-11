// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@ensdomains/ens-contracts/contracts/resolvers/profiles/IABIResolver.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/IAddrResolver.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/IAddressResolver.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/IContentHashResolver.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/IDNSRecordResolver.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/IDNSZoneResolver.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/IInterfaceResolver.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/INameResolver.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/IPubkeyResolver.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/ITextResolver.sol";

interface IPublicResolver is
    IABIResolver,
    IAddrResolver,
    IAddressResolver,
    IContentHashResolver,
    IDNSRecordResolver,
    IDNSZoneResolver,
    IInterfaceResolver,
    INameResolver,
    IPubkeyResolver,
    ITextResolver
{
    function setABI(bytes32 node, uint256 contentType, bytes calldata data) external;

    function setAddr(bytes32 node, address a) external;

    function setAddr(bytes32 node, uint256 coinType, bytes memory a) external;

    function setContenthash(bytes32 node, bytes calldata hash) external;

    function setDNSRecords(bytes32 node, bytes calldata data) external;

    function setZonehash(bytes32 node, bytes calldata hash) external;

    function setInterface(bytes32 node, bytes4 interfaceID, address implementer) external;

    function setName(bytes32 node, string calldata newName) external;

    function setPubkey(bytes32 node, bytes32 x, bytes32 y) external;

    function setText(bytes32 node, string calldata key, string calldata value) external;
}
