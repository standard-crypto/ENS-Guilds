// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

import "./IENSGuilds.sol";

/**
 * @dev {ERC1155} token, including:
 *
 *  - ability for holders to burn (destroy) their tokens
 *  - a minter role that allows for token minting (creation)
 *  - a pauser role that allows to stop all token transfers
 *
 * This contract uses {AccessControl} to lock permissioned functions using the
 * different roles - head to its documentation for details.
 *
 * The account that deploys the contract will be granted the minter and pauser
 * roles, as well as the default admin role, which will let it grant both minter
 * and pauser roles to other accounts.
 *
 * _Deprecated in favor of https://wizard.openzeppelin.com/[Contracts Wizard]._
 */
contract ENSGuilds is AccessControlEnumerable, ERC1155, Pausable, IENSGuilds {
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    constructor(string memory uri) ERC1155(uri) {
        _setupRole(PAUSER_ROLE, _msgSender());
    }

    function pause() public virtual {
        require(hasRole(PAUSER_ROLE, _msgSender()), "ENSGuilds: must have pauser role to pause");
        _pause();
    }

    function unpause() public virtual {
        require(hasRole(PAUSER_ROLE, _msgSender()), "ENSGuilds: must have pauser role to unpause");
        _unpause();
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(AccessControlEnumerable, ERC1155, IERC165) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) internal virtual override(ERC1155) {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }

    function registerGuild(
        bytes32 guildHash,
        address guildAdmin,
        address feePolicy,
        address tagsAuthPolicy
    ) external override {}

    function deregisterGuild(bytes32 guildHash) external override {}

    function claimGuildTag(
        bytes32 guildHash,
        bytes32 tagHash,
        address recipient,
        bytes calldata extraClaimArgs
    ) external payable override {}

    function claimGuildTagsBatch(
        bytes32 guildHash,
        bytes32[] calldata tagHashes,
        address[] calldata recipients,
        bytes[] calldata extraClaimArgs
    ) external payable override {}

    function revokeGuildTag(bytes32 guildHash, bytes32 tagHash) public override {}

    function updateGuildFeePolicy(bytes32 guildHash, address feePolicy) external override {}

    function updateGuildTagsAuthPolicy(bytes32 guildHash, address tagsAuthPolicy) external override {}

    function transferGuildAdmin(bytes32 guildHash, address newAdmin) external override {}
}
