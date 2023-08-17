// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import { IENSGuilds } from "../../ensGuilds/interfaces/IENSGuilds.sol";

/**
 * ClaimGuildTagReentrancyAttacker is a contract that exposes an apparently
 * benign lookup function that will re-invoke `claimGuildTag`.
 */
contract ClaimGuildTagReentrancyAttacker {
    IENSGuilds private immutable ensGuilds;

    bytes32 private guildEnsNode;
    string private tag;
    address private recipient;
    bytes private extraClaimArgs;

    constructor(
        IENSGuilds _ensGuilds,
        bytes32 _guildEnsNode,
        string memory _tag,
        address _recipient,
        bytes memory _extraClaimArgs
    ) {
        ensGuilds = _ensGuilds;

        guildEnsNode = _guildEnsNode;
        tag = _tag;
        recipient = _recipient;
        extraClaimArgs = _extraClaimArgs;
    }

    function insidiousLookupFunction() external returns (bool) {
        ensGuilds.claimGuildTag(guildEnsNode, tag, recipient, extraClaimArgs);
        return true;
    }
}
