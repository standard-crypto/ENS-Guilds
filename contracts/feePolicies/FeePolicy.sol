// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

/**
 * @title FeePolicy
 * @notice An interface for Guilds to implement that will specify how fees must be paid for guild tag mints
 */
abstract contract FeePolicy is ERC165 {
    function supportsInterface(bytes4 interfaceID) public view virtual override(ERC165) returns (bool) {
        return interfaceID == type(FeePolicy).interfaceId || super.supportsInterface(interfaceID);
    }

    /**
     * @notice Returns the fee required to mint the given guild tag by the given minter
     * @param guildHash The ENS namehash of the guild's domain
     * @param tagHash The ENS namehash of the tag being claimed (e.g. keccak256('foo') for foo.my-guild.eth)
     * @param claimant The address attempting to claim the tag (not necessarily the address that will receive it)
     * @param extraClaimArgs Any additional arguments that would be passed by the minter to the claimGuildTag() function
     * @return tokenContract The token contract the fee must be paid in (if any). Address(0) designates native Ether.
     * @return fee The amount (in base unit) that must be paid
     * @return feePaidTo The address that should receive payment of the fee
     */
    function tagClaimFee(
        bytes32 guildHash,
        bytes32 tagHash,
        address claimant,
        bytes calldata extraClaimArgs
    ) external view virtual returns (address tokenContract, uint256 fee, address feePaidTo);
}
