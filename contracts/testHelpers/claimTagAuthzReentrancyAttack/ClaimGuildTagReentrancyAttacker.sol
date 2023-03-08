// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "../../ensGuilds/interfaces/IENSGuilds.sol";

/**
 * ClaimGuildTagReentrancyAttacker is a contract that exposes an apparently
 * benign lookup function that will re-invoke `claimGuildTag`.
 */
contract ClaimGuildTagReentrancyAttacker {
    IENSGuilds private ensGuilds;

    bytes32 private guildEnsNode;
    bytes32 private tagHash;
    address private recipient;
    bytes private extraClaimArgs;

    constructor(
        IENSGuilds _ensGuilds,
        bytes32 _guildEnsNode,
        bytes32 _tagHash,
        address _recipient,
        bytes memory _extraClaimArgs
    ) {
        ensGuilds = _ensGuilds;

        guildEnsNode = _guildEnsNode;
        tagHash = _tagHash;
        recipient = _recipient;
        extraClaimArgs = _extraClaimArgs;
    }

    function insidiousLookupFunction() external returns (bool) {
        ensGuilds.claimGuildTag(guildEnsNode, tagHash, recipient, extraClaimArgs);
        return true;
    }
}
