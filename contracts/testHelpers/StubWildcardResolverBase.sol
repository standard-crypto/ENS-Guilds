// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import { NameEncoder } from "@ensdomains/ens-contracts/contracts/utils/NameEncoder.sol";
import { ENS } from "@ensdomains/ens-contracts/contracts/registry/ENS.sol";
import { INameWrapper } from "@ensdomains/ens-contracts/contracts/wrapper/INameWrapper.sol";

import { WildcardResolverBase } from "../ensWildcardResolvers/WildcardResolverBase.sol";

contract StubWildcardResolverBase is WildcardResolverBase {
    using NameEncoder for string;

    address private _resolveWildcardEthAddrRetVal;
    string private _resolveWildcardTextRecordRetVal;

    constructor(ENS _ensRegistry, INameWrapper _ensNameWrapper) WildcardResolverBase(_ensRegistry, _ensNameWrapper) {
        return;
    }

    function setPassthroughTarget(string calldata parentEnsName, address target) external {
        (bytes memory encodedName, bytes32 ensNode) = parentEnsName.dnsEncodeName();
        _setPassthroughTarget(ensNode, target);
        parentEnsNodes[encodedName] = ensNode;
    }

    function _resolveWildcardEthAddr(bytes calldata, bytes calldata) internal view override returns (address) {
        return _resolveWildcardEthAddrRetVal;
    }

    function _resolveWildcardTextRecord(
        bytes calldata,
        bytes calldata,
        string calldata
    ) internal view override returns (string memory) {
        return _resolveWildcardTextRecordRetVal;
    }

    function isAuthorised(bytes32) internal pure override returns (bool) {
        return true;
    }

    // solhint-disable func-name-mixedcase
    function stub_resolveWildcardEthAddr(address retVal) external {
        _resolveWildcardEthAddrRetVal = retVal;
    }

    function stub_resolveWildcardTextRecord(string calldata retVal) external {
        _resolveWildcardTextRecordRetVal = retVal;
    }
    // solhint-enable func-name-mixedcase
}
