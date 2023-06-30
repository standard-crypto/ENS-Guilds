// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

// Source: https://etherscan.io/address/0x226159d592e2b063810a10ebf6dcbada94ed68b8#code

import "@ensdomains/ens-contracts/contracts/resolvers/profiles/IABIResolver.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/IAddrResolver.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/IContentHashResolver.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/IInterfaceResolver.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/INameResolver.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/IPubkeyResolver.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/profiles/ITextResolver.sol";

interface IENSLegacyPublicResolver is
    IABIResolver,
    IAddrResolver,
    IContentHashResolver,
    IInterfaceResolver,
    INameResolver,
    IPubkeyResolver,
    ITextResolver
{
    /**
     * @dev Sets or clears an authorisation.
     * Authorisations are specific to the caller. Any account can set an authorisation
     * for any name, but the authorisation that is checked will be that of the
     * current owner of a name. Thus, transferring a name effectively clears any
     * existing authorisations, and new authorisations can be set in advance of
     * an ownership transfer if desired.
     *
     * @param node The name to change the authorisation on.
     * @param target The address that is to be authorised or deauthorised.
     * @param isAuthorised True if the address should be authorised, or false if it should be deauthorised.
     */
    function setAuthorisation(bytes32 node, address target, bool isAuthorised) external;

    function setABI(bytes32 node, uint256 contentType, bytes calldata data) external;

    function setAddr(bytes32 node, address a) external;

    function setContenthash(bytes32 node, bytes calldata hash) external;

    function setInterface(bytes32 node, bytes4 interfaceID, address implementer) external;

    function setName(bytes32 node, string calldata newName) external;

    function setPubkey(bytes32 node, bytes32 x, bytes32 y) external;

    function setText(bytes32 node, string calldata key, string calldata value) external;
}
