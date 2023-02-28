// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

abstract contract FeePolicy is ERC165 {
    function supportsInterface(bytes4 interfaceID) public view virtual override(ERC165) returns (bool) {
        return interfaceID == type(FeePolicy).interfaceId || super.supportsInterface(interfaceID);
    }

    // tokenContract(0) == ETH
    function tagClaimFee(
        bytes32 guildHash,
        bytes32 tagHash,
        address recipient,
        bytes calldata extraClaimArgs
    ) external view virtual returns (address tokenContract, uint256 fee, address feePaidTo);
}
