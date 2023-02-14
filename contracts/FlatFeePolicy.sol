// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/interfaces/IERC165.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/utils/Context.sol";

import "./IFeePolicy.sol";
import "./IENSGuilds.sol";

contract FlatFeePolicy is Context, IFeePolicy {
    using ERC165Checker for address;

    IENSGuilds private ensGuilds;
    struct FeeInfo {
        address feeToken;
        uint256 fee;
        address feePaidTo;
    }
    mapping(bytes32 => FeeInfo) guildFees;

    constructor(address _ensGuilds) {
        require(_ensGuilds.supportsInterface(type(IENSGuilds).interfaceId));
        ensGuilds = IENSGuilds(_ensGuilds);
    }

    function setFlatFee(bytes32 guildHash, address feeToken, uint256 fee, address feePaidTo) external {
        // caller must be guild admin
        require(ensGuilds.guildAdmin(guildHash) == _msgSender());

        guildFees[guildHash] = FeeInfo({ feeToken: feeToken, fee: fee, feePaidTo: feePaidTo });
    }

    function tagClaimFee(
        bytes32 guildHash,
        bytes32 tagHash,
        address recipient,
        bytes calldata extraClaimArgs
    ) external view virtual override returns (address tokenContract, uint256 fee, address feePaidTo) {
        FeeInfo storage feeInfo = guildFees[guildHash];
        return (feeInfo.feeToken, feeInfo.fee, feeInfo.feePaidTo);
    }
}
