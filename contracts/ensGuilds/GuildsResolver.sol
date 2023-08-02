// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@ensdomains/ens-contracts/contracts/utils/NameEncoder.sol";
import "@ensdomains/ens-contracts/contracts/reverseRegistrar/ReverseClaimer.sol";

import "../ensWildcardResolvers/WildcardResolverBase.sol";
import "../libraries/ENSByteUtils.sol";
import "./interfaces/IENSGuilds.sol";

contract GuildsResolver is WildcardResolverBase, ReverseClaimer {
    using NameEncoder for string;

    IENSGuilds public ensGuilds;

    // guildEnsNode => recordVersion => keccak256(tag) => tagOwner
    mapping(bytes32 => mapping(uint256 => mapping(bytes32 => address))) private _guildRecords;

    // used to clear all of a Guild's ENS records
    mapping(bytes32 => uint256) private _guildRecordVersions;

    modifier onlyEnsGuildsContract() {
        // solhint-disable-next-line reason-string
        require(_msgSender() == address(ensGuilds));
        _;
    }

    constructor(
        ENS _ensRegistry,
        INameWrapper _ensNameWrapper,
        address reverseRecordOwner
    ) WildcardResolverBase(_ensRegistry, _ensNameWrapper) ReverseClaimer(_ensRegistry, reverseRecordOwner) {
        return;
    }

    function initialize(IENSGuilds _ensGuilds) external {
        // solhint-disable reason-string
        require(address(ensGuilds) == address(0));
        require(_ensGuilds.supportsInterface(type(IENSGuilds).interfaceId));
        // solhint-enable reason-string

        ensGuilds = _ensGuilds;
    }

    function onGuildRegistered(string calldata guildName) external onlyEnsGuildsContract {
        // need to keep track of the mapping from the DNS-encoded version
        // of the guild name to its namehash-encoded version
        (bytes memory dnsEncodedName, bytes32 ensNode) = guildName.dnsEncodeName();
        parentEnsNodes[dnsEncodedName] = ensNode;
    }

    /**
     * Sets the address associated with a guild tag.
     * May only be called by descendants of this contract
     */
    function setEnsForwardRecord(
        bytes32 guildEnsNode,
        string memory tag,
        address _addr
    ) external onlyEnsGuildsContract {
        uint256 version = _guildRecordVersions[guildEnsNode];
        bytes32 tagHash = keccak256(bytes(tag));
        _guildRecords[guildEnsNode][version][tagHash] = _addr;
    }

    function clearEnsRecordsForGuild(bytes32 guildEnsNode) external onlyEnsGuildsContract {
        _guildRecordVersions[guildEnsNode]++;
    }

    function setPassthroughTarget(bytes32 guildEnsNode, address resolver) external onlyEnsGuildsContract {
        _setPassthroughTarget(guildEnsNode, resolver);
    }

    function getTagOwner(bytes32 guildEnsNode, bytes32 tagHash) public view returns (address) {
        uint256 version = _guildRecordVersions[guildEnsNode];
        return _guildRecords[guildEnsNode][version][tagHash];
    }

    function _resolveWildcardEthAddr(
        bytes calldata childUtf8Encoded,
        bytes calldata parentDnsEncoded
    ) internal view override returns (address) {
        bytes32 guildEnsNode = parentEnsNodes[parentDnsEncoded];
        bytes32 tagHash = keccak256(childUtf8Encoded);
        return getTagOwner(guildEnsNode, tagHash);
    }

    function _resolveWildcardTextRecord(
        bytes calldata,
        bytes calldata,
        string calldata
    ) internal pure override returns (string memory) {
        // ENSGuilds doesn't set text records for Guild tags
        return "";
    }

    function isAuthorised(bytes32 node) internal view override returns (bool) {
        return _msgSender() == _nodeOwner(node);
    }
}
