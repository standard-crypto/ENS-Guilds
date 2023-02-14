// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/interfaces/IERC165.sol";

abstract contract IFeePolicy is IERC165 {
    function supportsInterface(bytes4 interfaceID) public view virtual override returns (bool) {
        return interfaceID == type(IFeePolicy).interfaceId;
    }

    // tokenContract(0) == ETH
    function tagClaimFee(
        bytes32 guildHash,
        bytes32 tagHash,
        address recipient,
        bytes calldata extraClaimArgs
    ) external view virtual returns (address tokenContract, uint256 fee, address feePaidTo);
}
