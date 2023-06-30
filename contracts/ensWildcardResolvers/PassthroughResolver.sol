// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@ensdomains/ens-contracts/contracts/registry/ENS.sol";
import "@ensdomains/ens-contracts/contracts/resolvers/ResolverBase.sol";
import "@ensdomains/ens-contracts/contracts/wrapper/INameWrapper.sol";
import "./IPublicResolver.sol";

/**
 * @dev PassthroughResolver is an ENS Resolver that forwards all calls to a
 * fallback Resolver. A custom resolver may inherit this contract
 * to selectively implement specific record types, deferring all others to the
 * fallback Resolver (usually whatever public Resolver the ENS app set on behalf
 * of the user when a name was registered).
 */
abstract contract PassthroughResolver is Ownable, ResolverBase, IPublicResolver {
    ENS public immutable ens;
    INameWrapper public immutable nameWrapper;

    mapping(bytes32 => IPublicResolver) internal passthroughTargets;

    constructor(ENS _ens, INameWrapper wrapperAddress) {
        ens = _ens;
        nameWrapper = wrapperAddress;
    }

    function isAuthorised(bytes32) internal view virtual override returns (bool);

    function supportsInterface(bytes4 interfaceID) public view virtual override returns (bool) {
        return
            interfaceID == type(IABIResolver).interfaceId ||
            interfaceID == type(IAddrResolver).interfaceId ||
            interfaceID == type(IAddressResolver).interfaceId ||
            interfaceID == type(IContentHashResolver).interfaceId ||
            interfaceID == type(IDNSRecordResolver).interfaceId ||
            interfaceID == type(IDNSZoneResolver).interfaceId ||
            interfaceID == type(IInterfaceResolver).interfaceId ||
            interfaceID == type(INameResolver).interfaceId ||
            interfaceID == type(IPubkeyResolver).interfaceId ||
            interfaceID == type(ITextResolver).interfaceId ||
            super.supportsInterface(interfaceID);
    }

    function setABI(bytes32 node, uint256 contentType, bytes calldata data) external virtual authorised(node) {
        passthroughTargets[node].setABI(node, contentType, data);
    }

    // solhint-disable-next-line func-name-mixedcase
    function ABI(bytes32 node, uint256 contentTypes) external view virtual override returns (uint256, bytes memory) {
        return passthroughTargets[node].ABI(node, contentTypes);
    }

    function setAddr(bytes32 node, address a) external virtual authorised(node) {
        passthroughTargets[node].setAddr(node, a);
    }

    function addr(bytes32 node) public view virtual override returns (address payable) {
        return passthroughTargets[node].addr(node);
    }

    function setAddr(bytes32 node, uint256 coinType, bytes memory a) public virtual authorised(node) {
        passthroughTargets[node].setAddr(node, coinType, a);
    }

    function addr(bytes32 node, uint256 coinType) public view virtual override returns (bytes memory) {
        return passthroughTargets[node].addr(node, coinType);
    }

    function setContenthash(bytes32 node, bytes calldata hash) external virtual authorised(node) {
        passthroughTargets[node].setContenthash(node, hash);
    }

    function contenthash(bytes32 node) external view virtual override returns (bytes memory) {
        return passthroughTargets[node].contenthash(node);
    }

    function setDNSRecords(bytes32 node, bytes calldata data) external virtual authorised(node) {
        passthroughTargets[node].setDNSRecords(node, data);
    }

    function dnsRecord(
        bytes32 node,
        bytes32 name,
        uint16 resource
    ) public view virtual override returns (bytes memory) {
        return passthroughTargets[node].dnsRecord(node, name, resource);
    }

    function hasDNSRecords(bytes32 node, bytes32 name) public view virtual returns (bool) {
        return passthroughTargets[node].hasDNSRecords(node, name);
    }

    function setZonehash(bytes32 node, bytes calldata hash) external virtual authorised(node) {
        passthroughTargets[node].setZonehash(node, hash);
    }

    function zonehash(bytes32 node) external view virtual override returns (bytes memory) {
        return passthroughTargets[node].zonehash(node);
    }

    function setInterface(bytes32 node, bytes4 interfaceID, address implementer) external virtual authorised(node) {
        passthroughTargets[node].setInterface(node, interfaceID, implementer);
    }

    function interfaceImplementer(bytes32 node, bytes4 interfaceID) external view virtual override returns (address) {
        return passthroughTargets[node].interfaceImplementer(node, interfaceID);
    }

    function setName(bytes32 node, string calldata newName) external virtual authorised(node) {
        passthroughTargets[node].setName(node, newName);
    }

    function name(bytes32 node) external view virtual override returns (string memory) {
        return passthroughTargets[node].name(node);
    }

    function setPubkey(bytes32 node, bytes32 x, bytes32 y) external virtual authorised(node) {
        passthroughTargets[node].setPubkey(node, x, y);
    }

    function pubkey(bytes32 node) external view virtual override returns (bytes32 x, bytes32 y) {
        return passthroughTargets[node].pubkey(node);
    }

    function setText(bytes32 node, string calldata key, string calldata value) external virtual authorised(node) {
        passthroughTargets[node].setText(node, key, value);
    }

    function text(bytes32 node, string calldata key) public view virtual override returns (string memory) {
        return passthroughTargets[node].text(node, key);
    }
}
