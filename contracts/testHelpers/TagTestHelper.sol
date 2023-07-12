// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

import "../tagsAuthPolicies/ITagsAuthPolicy.sol";

contract TagTestHelper is ITagsAuthPolicy, ERC165 {
    string private _onTagClaimedRetVal;
    bool private _tagCanBeRevokedRetVal = true;

    function supportsInterface(bytes4 interfaceID) public view virtual override(IERC165, ERC165) returns (bool) {
        return interfaceID == type(ITagsAuthPolicy).interfaceId || super.supportsInterface(interfaceID);
    }

    function canClaimTag(
        bytes32,
        string calldata,
        address,
        address,
        bytes calldata
    ) external view virtual override returns (bool) {
        return true;
    }

    function onTagClaimed(
        bytes32,
        string calldata,
        address,
        address,
        bytes calldata
    ) external virtual override returns (string memory tagToRevoke) {
        return _onTagClaimedRetVal;
    }

    function canTransferTag(
        bytes32,
        string calldata,
        address,
        address,
        address,
        bytes calldata
    ) external pure override returns (bool) {
        return false;
    }

    function onTagTransferred(bytes32, string calldata, address, address, address) external pure override {
        return;
    }

    function canRevokeTag(
        address,
        bytes32,
        string calldata,
        bytes calldata
    ) external view virtual override returns (bool) {
        return _tagCanBeRevokedRetVal;
    }

    function onTagRevoked(address, address, bytes32, string memory) external virtual override {
        return;
    }

    // solhint-disable func-name-mixedcase
    function stub_tagCanBeRevokedReturnVal(bool retVal) external {
        _tagCanBeRevokedRetVal = retVal;
    }

    function stub_onTagClaimedReturnVal(string calldata retVal) external {
        _onTagClaimedRetVal = retVal;
    }
    // solhint-enable func-name-mixedcase
}
