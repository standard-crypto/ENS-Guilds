// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/interfaces/IERC165.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/utils/Context.sol";

import "./FeePolicy.sol";
import "../ensGuilds/interfaces/IENSGuilds.sol";

contract FlatFeePolicy is Context, FeePolicy {
    using ERC165Checker for address;

    IENSGuilds private ensGuilds;
    struct FeeInfo {
        address feeToken;
        uint256 fee;
        address feePaidTo;
    }
    mapping(bytes32 => FeeInfo) public guildFees;

    constructor(address _ensGuilds) {
        // solhint-disable-next-line reason-string
        require(_ensGuilds.supportsInterface(type(IENSGuilds).interfaceId));
        ensGuilds = IENSGuilds(_ensGuilds);
    }

    function setFlatFee(bytes32 guildHash, address feeToken, uint256 fee, address feePaidTo) external {
        // caller must be guild admin
        // solhint-disable-next-line reason-string
        require(ensGuilds.guildAdmin(guildHash) == _msgSender());

        guildFees[guildHash] = FeeInfo({ feeToken: feeToken, fee: fee, feePaidTo: feePaidTo });
    }

    function tagClaimFee(
        bytes32 guildHash,
        bytes32,
        address,
        bytes calldata
    ) external view virtual override returns (address tokenContract, uint256 fee, address feePaidTo) {
        FeeInfo storage feeInfo = guildFees[guildHash];
        return (feeInfo.feeToken, feeInfo.fee, feeInfo.feePaidTo);
    }
}
