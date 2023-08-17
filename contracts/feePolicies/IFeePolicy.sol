// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import { IERC165 } from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/**
 * @title IFeePolicy
 * @notice An interface for Guilds to implement that will specify how fees must be paid for guild tag mints
 */
interface IFeePolicy is IERC165 {
    /**
     * @notice Returns the fee required to mint the given guild tag by the given minter
     * @param guildHash The ENS namehash of the guild's domain
     * @param tag The tag being claimed (e.g. 'foo' for foo.my-guild.eth)
     * @param claimant The address attempting to claim the tag (not necessarily the address that will receive it)
     * @param extraClaimArgs Any additional arguments that would be passed by the minter to the claimGuildTag() function
     * @return tokenContract The token contract the fee must be paid in (if any). Address(0) designates native Ether.
     * @return fee The amount (in base unit) that must be paid
     * @return feePaidTo The address that should receive payment of the fee
     */
    function tagClaimFee(
        bytes32 guildHash,
        string calldata tag,
        address claimant,
        bytes calldata extraClaimArgs
    ) external view returns (address tokenContract, uint256 fee, address feePaidTo);
}
