// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@ensdomains/ens-contracts/contracts/resolvers/ResolverBase.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "./IPublicResolver.sol";

/**
 * @dev PassthroughResolver is an ENS Resolver that forwards all calls to a
 * fallback Resolver. A custom resolver may inherit this contract
 * to selectively implement specific record types, deferring all others to the
 * fallback Resolver (usually whatever public Resolver the ENS app set on behalf
 * of the user when a name was registered).
 *
 * The owner of the ENS name must first configure their PublicResolver to approve
 * this contract as an authorized manager on the owner's behalf for the setter
 * methods of PassthroughResolver to work. Note that this delegation is separate
 * from approvals set with the ENS Registry. ENS's public Registry and its public
 * Resolvers each have their own, independent concepts of approved managers.
 */
abstract contract PassthroughResolver is IPublicResolver, ResolverBase {
    using ERC165Checker for address;

    mapping(bytes32 => address) private _passthroughTargets;

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

    function getPassthroughTarget(bytes32 node) public view virtual returns (address resolver) {
        return _passthroughTargets[node];
    }

    function _setPassthroughTarget(bytes32 node, address target) internal {
        _passthroughTargets[node] = target;
    }

    function setABI(bytes32 node, uint256 contentType, bytes calldata data) external virtual authorised(node) {
        IPublicResolver(getPassthroughTarget(node)).setABI(node, contentType, data);
    }

    // solhint-disable-next-line func-name-mixedcase
    function ABI(
        bytes32 node,
        uint256 contentTypes
    ) external view virtual override returns (uint256 a, bytes memory b) {
        address target = getPassthroughTarget(node);
        if (target.supportsInterface(type(IABIResolver).interfaceId)) {
            return IABIResolver(target).ABI(node, contentTypes);
        }
    }

    function setAddr(bytes32 node, address a) external virtual authorised(node) {
        IPublicResolver(getPassthroughTarget(node)).setAddr(node, a);
    }

    function addr(bytes32 node) public view virtual override returns (address payable result) {
        address target = getPassthroughTarget(node);
        if (target.supportsInterface(type(IAddrResolver).interfaceId)) {
            return IAddrResolver(target).addr(node);
        }
    }

    function setAddr(bytes32 node, uint256 coinType, bytes memory a) public virtual authorised(node) {
        IPublicResolver(getPassthroughTarget(node)).setAddr(node, coinType, a);
    }

    function addr(bytes32 node, uint256 coinType) public view virtual override returns (bytes memory result) {
        address target = getPassthroughTarget(node);
        if (target.supportsInterface(type(IAddressResolver).interfaceId)) {
            return IAddressResolver(target).addr(node, coinType);
        }
    }

    function setContenthash(bytes32 node, bytes calldata hash) external virtual authorised(node) {
        IPublicResolver(getPassthroughTarget(node)).setContenthash(node, hash);
    }

    function contenthash(bytes32 node) external view virtual override returns (bytes memory result) {
        address target = getPassthroughTarget(node);
        if (target.supportsInterface(type(IContentHashResolver).interfaceId)) {
            return IContentHashResolver(target).contenthash(node);
        }
    }

    function setDNSRecords(bytes32 node, bytes calldata data) external virtual authorised(node) {
        IPublicResolver(getPassthroughTarget(node)).setDNSRecords(node, data);
    }

    function dnsRecord(
        bytes32 node,
        bytes32 name, // solhint-disable-line
        uint16 resource
    ) public view virtual override returns (bytes memory result) {
        address target = getPassthroughTarget(node);
        if (target.supportsInterface(type(IDNSRecordResolver).interfaceId)) {
            return IDNSRecordResolver(target).dnsRecord(node, name, resource);
        }
    }

    function setZonehash(bytes32 node, bytes calldata hash) external virtual authorised(node) {
        IPublicResolver(getPassthroughTarget(node)).setZonehash(node, hash);
    }

    function zonehash(bytes32 node) external view virtual override returns (bytes memory result) {
        address target = getPassthroughTarget(node);
        if (target.supportsInterface(type(IDNSZoneResolver).interfaceId)) {
            return IDNSZoneResolver(target).zonehash(node);
        }
    }

    function setInterface(bytes32 node, bytes4 interfaceID, address implementer) external virtual authorised(node) {
        IPublicResolver(getPassthroughTarget(node)).setInterface(node, interfaceID, implementer);
    }

    function interfaceImplementer(
        bytes32 node,
        bytes4 interfaceID
    ) external view virtual override returns (address result) {
        address target = getPassthroughTarget(node);
        if (target.supportsInterface(type(IInterfaceResolver).interfaceId)) {
            return IInterfaceResolver(target).interfaceImplementer(node, interfaceID);
        }
    }

    function setName(bytes32 node, string calldata newName) external virtual authorised(node) {
        IPublicResolver(getPassthroughTarget(node)).setName(node, newName);
    }

    function name(bytes32 node) external view virtual override returns (string memory result) {
        address target = getPassthroughTarget(node);
        if (target.supportsInterface(type(INameResolver).interfaceId)) {
            return INameResolver(target).name(node);
        }
    }

    function setPubkey(bytes32 node, bytes32 x, bytes32 y) external virtual authorised(node) {
        IPublicResolver(getPassthroughTarget(node)).setPubkey(node, x, y);
    }

    function pubkey(bytes32 node) external view virtual override returns (bytes32 x, bytes32 y) {
        address target = getPassthroughTarget(node);
        if (target.supportsInterface(type(IPubkeyResolver).interfaceId)) {
            return IPubkeyResolver(target).pubkey(node);
        }
    }

    function setText(bytes32 node, string calldata key, string calldata value) external virtual authorised(node) {
        IPublicResolver(getPassthroughTarget(node)).setText(node, key, value);
    }

    function text(bytes32 node, string calldata key) public view virtual override returns (string memory result) {
        address target = getPassthroughTarget(node);
        if (target.supportsInterface(type(ITextResolver).interfaceId)) {
            return ITextResolver(target).text(node, key);
        }
    }
}
