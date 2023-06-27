// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/interfaces/IERC165.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@openzeppelin/contracts/utils/Context.sol";

import "./FeePolicy.sol";
import "../ensGuilds/interfaces/IENSGuilds.sol";

/**
 * @title FlatFeePolicy
 * @notice A common implementation of FeePolicy that can be used to configure
 * flat-rate fees for multiple guilds simultaneously
 */
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

    /**
     * @notice Configures a flat fee for the given guild. The caller must be the guild's admin
     * @param guildHash The ENS namehash of the guild's domain
     * @param feeToken The token contract the fee must be paid in (if any). Address(0) designates native Ether.
     * @param fee The amount (in base unit) that must be paid
     * @param feePaidTo The address that should receive payment of the fee
     */
    function setFlatFee(bytes32 guildHash, address feeToken, uint256 fee, address feePaidTo) external {
        // caller must be guild admin
        // solhint-disable-next-line reason-string
        require(ensGuilds.guildAdmin(guildHash) == _msgSender());

        guildFees[guildHash] = FeeInfo({ feeToken: feeToken, fee: fee, feePaidTo: feePaidTo });
    }

    /**
     * @inheritdoc FeePolicy
     */
    function tagClaimFee(
        bytes32 guildHash,
        string calldata,
        address,
        bytes calldata
    ) external view virtual override returns (address tokenContract, uint256 fee, address feePaidTo) {
        FeeInfo storage feeInfo = guildFees[guildHash];
        return (feeInfo.feeToken, feeInfo.fee, feeInfo.feePaidTo);
    }
}
