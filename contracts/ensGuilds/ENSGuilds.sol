// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@ensdomains/ens-contracts/contracts/registry/ENS.sol";
import "@ensdomains/ens-contracts/contracts/reverseRegistrar/ReverseClaimer.sol";
import { INameWrapper, CAN_DO_EVERYTHING } from "@ensdomains/ens-contracts/contracts/wrapper/INameWrapper.sol";

import "../feePolicies/IFeePolicy.sol";
import "../tagsAuthPolicies/ITagsAuthPolicy.sol";
import "../libraries/ENSNamehash.sol";
import "./interfaces/IENSGuilds.sol";
import "./mixins/GuildTagTokens.sol";
import "./mixins/ENSGuildsHumanized.sol";
import "./GuildsResolver.sol";

contract ENSGuilds is IENSGuilds, ENSGuildsHumanized, GuildTagTokens, ERC1155Holder, ReentrancyGuard, ReverseClaimer {
    struct GuildInfo {
        address admin;
        IFeePolicy feePolicy;
        ITagsAuthPolicy tagsAuthPolicy;
        address originalResolver;
        bool active;
        bool deregistered;
        bool usesNameWrapper;
    }

    using ERC165Checker for address;
    using ENSNamehash for bytes;

    /** State */
    ENS private immutable _ensRegistry;
    INameWrapper private immutable _nameWrapper;
    GuildsResolver private immutable _guildsResolver;
    mapping(bytes32 => GuildInfo) public guilds;

    /** Errors */
    error AlreadyRegistered();
    error ENSGuildsIsNotRegisteredOperator();
    error NotDomainOwner();
    error InvalidPolicy(address);
    error GuildNotActive();
    error ClaimUnauthorized();
    error RevokeUnauthorized();
    error TransferUnauthorized();
    error GuildAdminOnly();
    error TagAlreadyClaimed();
    error FeeError();

    modifier onlyGuildAdmin(bytes32 guildHash) {
        if (guilds[guildHash].admin != _msgSender()) {
            revert GuildAdminOnly();
        }
        _;
    }

    modifier requireGuildRegistered(bytes32 guildEnsNode) {
        if (guilds[guildEnsNode].deregistered) {
            revert GuildNotActive();
        }
        _;
    }

    modifier requireGuildActive(bytes32 guildEnsNode) {
        if (!guilds[guildEnsNode].active || guilds[guildEnsNode].deregistered) {
            revert GuildNotActive();
        }
        _;
    }

    constructor(
        string memory defaultTokenMetadataUri,
        ENS ensRegistry,
        INameWrapper nameWrapper,
        GuildsResolver guildsResolver,
        address reverseRecordOwner
    ) ERC1155(defaultTokenMetadataUri) ReverseClaimer(ensRegistry, reverseRecordOwner) {
        _ensRegistry = ensRegistry;
        _nameWrapper = nameWrapper;
        _guildsResolver = guildsResolver;
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(GuildTagTokens, ERC1155Receiver, IERC165) returns (bool) {
        return
            interfaceId == type(IENSGuilds).interfaceId ||
            GuildTagTokens.supportsInterface(interfaceId) ||
            ERC1155Receiver.supportsInterface(interfaceId) ||
            ERC165.supportsInterface(interfaceId);
    }

    /**
     * @inheritdoc IENSGuilds
     */
    function registerGuild(
        string calldata guildName,
        address admin,
        address feePolicy,
        address tagsAuthPolicy
    ) public override(IENSGuilds) {
        bytes32 ensNode = bytes(guildName).namehash();

        // Determine whether this name is using the ENS NameWrapper
        address nodeOwner = _ensRegistry.owner(ensNode);
        bool usesNameWrapper = false;
        if (nodeOwner == address(_nameWrapper)) {
            nodeOwner = _nameWrapper.ownerOf(uint256(ensNode));
            usesNameWrapper = true;
        }

        // Check caller is owner of domain
        if (nodeOwner != _msgSender()) {
            revert NotDomainOwner();
        }

        // Check guild not yet registered
        if (address(guilds[ensNode].feePolicy) != address(0)) {
            revert AlreadyRegistered();
        }

        // Check ENSGuilds contract has been approved to edit the ENS registry on behalf of the caller
        if (usesNameWrapper && !_nameWrapper.isApprovedForAll(_msgSender(), address(this))) {
            revert ENSGuildsIsNotRegisteredOperator();
        }
        if (!usesNameWrapper && !_ensRegistry.isApprovedForAll(_msgSender(), address(this))) {
            revert ENSGuildsIsNotRegisteredOperator();
        }

        // Check for valid fee/tagsAuth policies
        if (!feePolicy.supportsInterface(type(IFeePolicy).interfaceId)) {
            revert InvalidPolicy(feePolicy);
        }
        if (!tagsAuthPolicy.supportsInterface(type(ITagsAuthPolicy).interfaceId)) {
            revert InvalidPolicy(tagsAuthPolicy);
        }

        // Store the config for this Guild
        address originalResolver = _ensRegistry.resolver(ensNode);
        guilds[ensNode] = GuildInfo({
            admin: admin,
            feePolicy: IFeePolicy(feePolicy),
            tagsAuthPolicy: ITagsAuthPolicy(tagsAuthPolicy),
            originalResolver: originalResolver,
            active: true,
            deregistered: false,
            usesNameWrapper: usesNameWrapper
        });

        // Set GuildsResolver as the resolver for the Guild's ENS name
        _guildsResolver.setPassthroughTarget(ensNode, originalResolver);
        _setResolverForGuild(ensNode, address(_guildsResolver));
        _guildsResolver.onGuildRegistered(guildName);

        // Done
        emit Registered(ensNode);
    }

    /**
     * @inheritdoc IENSGuilds
     */
    function deregisterGuild(
        bytes32 ensNode
    ) public override(ENSGuildsHumanized, IENSGuilds) onlyGuildAdmin(ensNode) requireGuildRegistered(ensNode) {
        // wipe all the ENS records so that this guild may be re-registered later with a clean state
        _guildsResolver.clearEnsRecordsForGuild(ensNode);

        // un-set ENSGuilds as the resolver for the guild's ENS name
        address originalResolver = guilds[ensNode].originalResolver;
        _setResolverForGuild(ensNode, address(originalResolver));

        // clear out internal state
        guilds[ensNode] = GuildInfo({
            deregistered: true,
            admin: address(0),
            feePolicy: IFeePolicy(address(0)),
            tagsAuthPolicy: ITagsAuthPolicy(address(0)),
            originalResolver: address(0),
            active: false,
            usesNameWrapper: false
        });
        emit Deregistered(ensNode);
    }

    /**
     * @inheritdoc IENSGuilds
     */
    function claimGuildTag(
        bytes32 guildEnsNode,
        string calldata tag,
        address recipient,
        bytes calldata extraClaimArgs
    ) public payable override(ENSGuildsHumanized, IENSGuilds) nonReentrant requireGuildActive(guildEnsNode) {
        bytes32 tagHash = keccak256(bytes(tag));

        // check tag not already registered
        bytes32 tagEnsNode = keccak256(abi.encodePacked(guildEnsNode, tagHash));
        if (_ensRegistry.owner(tagEnsNode) != address(0)) {
            // this is a pre-existing sub-name already registered outside of the Guilds context
            revert TagAlreadyClaimed();
        }
        if (tagOwner(guildEnsNode, tagHash) != address(0)) {
            // already registered as a Guild tag
            revert TagAlreadyClaimed();
        }

        // check caller is authorized to claim tag
        ITagsAuthPolicy auth = guilds[guildEnsNode].tagsAuthPolicy;
        if (!auth.canClaimTag(guildEnsNode, tag, _msgSender(), recipient, extraClaimArgs)) {
            revert ClaimUnauthorized();
        }

        // fees
        _handleClaimFee(guildEnsNode, tag, extraClaimArgs);

        // NFT mint
        _mintNewGuildToken(guildEnsNode, tagHash, recipient);

        // inform auth contract that tag was claimed, then revoke an existing tag if instructed
        string memory tagToRevoke = auth.onTagClaimed(guildEnsNode, tag, _msgSender(), recipient, extraClaimArgs);
        if (bytes(tagToRevoke).length != 0) {
            _revokeTag(guildEnsNode, tagToRevoke);
        }

        // Set forward record in ENS resolver
        _guildsResolver.setEnsForwardRecord(guildEnsNode, tag, recipient);

        emit TagClaimed(guildEnsNode, tagHash, recipient);
    }

    /**
     * @inheritdoc IENSGuilds
     */
    function claimGuildTagsBatch(
        bytes32 guildEnsNode,
        string[] calldata tags,
        address[] calldata recipients,
        bytes[] calldata extraClaimArgs
    ) external payable override {
        for (uint i = 0; i < tags.length; i++) {
            claimGuildTag(guildEnsNode, tags[i], recipients[i], extraClaimArgs[i]);
        }
    }

    /**
     * @inheritdoc IENSGuilds
     */
    function transferGuildTag(
        bytes32 guildEnsNode,
        string calldata tag,
        address recipient,
        bytes calldata extraTransferArgs
    ) public override(ENSGuildsHumanized, IENSGuilds) nonReentrant requireGuildActive(guildEnsNode) {
        bytes32 tagHash = keccak256(bytes(tag));
        address currentOwner = tagOwner(guildEnsNode, tagHash);

        // check that tag exists
        if (currentOwner == address(0)) {
            revert TransferUnauthorized();
        }

        // transfer authorized?
        ITagsAuthPolicy auth = guilds[guildEnsNode].tagsAuthPolicy;
        if (!auth.canTransferTag(guildEnsNode, tag, _msgSender(), currentOwner, recipient, extraTransferArgs)) {
            revert TransferUnauthorized();
        }

        // NFT transfer
        _transferGuildToken(guildEnsNode, tagHash, currentOwner, recipient);

        // Update forward record in ENS resolver
        _guildsResolver.setEnsForwardRecord(guildEnsNode, tag, recipient);

        // Inform auth contract that tag was transferred
        auth.onTagTransferred(guildEnsNode, tag, _msgSender(), currentOwner, recipient);

        emit TagTransferred(guildEnsNode, tagHash, currentOwner, recipient);
    }

    /**
     * @inheritdoc IENSGuilds
     */
    function guildAdmin(bytes32 guildHash) public view override(ENSGuildsHumanized, IENSGuilds) returns (address) {
        return guilds[guildHash].admin;
    }

    /**
     * @inheritdoc IENSGuilds
     */
    function revokeGuildTag(
        bytes32 guildEnsNode,
        string calldata tag,
        bytes calldata extraData
    ) public override(ENSGuildsHumanized, IENSGuilds) nonReentrant requireGuildRegistered(guildEnsNode) {
        GuildInfo storage guild = guilds[guildEnsNode];

        // revoke authorized?
        ITagsAuthPolicy auth = guild.tagsAuthPolicy;
        if (!auth.canRevokeTag(_msgSender(), guildEnsNode, tag, extraData)) {
            revert RevokeUnauthorized();
        }

        _revokeTag(guildEnsNode, tag);
    }

    /**
     * @inheritdoc IENSGuilds
     */
    function revokeGuildTagsBatch(
        bytes32 guildHash,
        string[] calldata tags,
        bytes[] calldata extraData
    ) external override {
        for (uint i = 0; i < tags.length; i++) {
            revokeGuildTag(guildHash, tags[i], extraData[i]);
        }
    }

    /**
     * @inheritdoc IENSGuilds
     */
    function updateGuildFeePolicy(
        bytes32 guildEnsNode,
        address feePolicy
    )
        public
        override(ENSGuildsHumanized, IENSGuilds)
        onlyGuildAdmin(guildEnsNode)
        requireGuildRegistered(guildEnsNode)
    {
        if (!feePolicy.supportsInterface(type(IFeePolicy).interfaceId)) {
            revert InvalidPolicy(feePolicy);
        }
        guilds[guildEnsNode].feePolicy = IFeePolicy(feePolicy);
        emit FeePolicyUpdated(guildEnsNode, feePolicy);
    }

    /**
     * @inheritdoc IENSGuilds
     */
    function updateGuildTagsAuthPolicy(
        bytes32 guildEnsNode,
        address tagsAuthPolicy
    )
        public
        override(ENSGuildsHumanized, IENSGuilds)
        onlyGuildAdmin(guildEnsNode)
        requireGuildRegistered(guildEnsNode)
    {
        if (!tagsAuthPolicy.supportsInterface(type(ITagsAuthPolicy).interfaceId)) {
            revert InvalidPolicy(tagsAuthPolicy);
        }
        guilds[guildEnsNode].tagsAuthPolicy = ITagsAuthPolicy(tagsAuthPolicy);
        emit TagsAuthPolicyUpdated(guildEnsNode, tagsAuthPolicy);
    }

    /**
     * @inheritdoc IENSGuilds
     */
    function transferGuildAdmin(
        bytes32 guildEnsNode,
        address newAdmin
    )
        public
        override(ENSGuildsHumanized, IENSGuilds)
        onlyGuildAdmin(guildEnsNode)
        requireGuildRegistered(guildEnsNode)
    {
        guilds[guildEnsNode].admin = newAdmin;
        emit AdminTransferred(guildEnsNode, newAdmin);
    }

    /**
     * @inheritdoc IENSGuilds
     */
    function setGuildTokenUriTemplate(
        bytes32 guildEnsNode,
        string calldata uriTemplate
    )
        public
        override(ENSGuildsHumanized, IENSGuilds)
        onlyGuildAdmin(guildEnsNode)
        requireGuildRegistered(guildEnsNode)
    {
        _setGuildTokenURITemplate(guildEnsNode, uriTemplate);
        emit TokenUriTemplateSet(guildEnsNode, uriTemplate);
    }

    /**
     * @inheritdoc IENSGuilds
     */
    function setGuildActive(
        bytes32 guildEnsNode,
        bool active
    )
        public
        override(ENSGuildsHumanized, IENSGuilds)
        onlyGuildAdmin(guildEnsNode)
        requireGuildRegistered(guildEnsNode)
    {
        guilds[guildEnsNode].active = active;
        emit SetActive(guildEnsNode, active);
    }

    /**
     * @inheritdoc IENSGuilds
     */
    function tagOwner(
        bytes32 guildEnsNode,
        bytes32 tagHash
    ) public view override(ENSGuildsHumanized, IENSGuilds) returns (address) {
        return _guildsResolver.getTagOwner(guildEnsNode, tagHash);
    }

    /**
     * @inheritdoc IENSGuilds
     */
    function setFallbackResolver(
        bytes32 guildEnsNode,
        address fallbackResolver
    ) public onlyGuildAdmin(guildEnsNode) requireGuildRegistered(guildEnsNode) {
        _guildsResolver.setPassthroughTarget(guildEnsNode, fallbackResolver);
    }

    function _revokeTag(bytes32 guildEnsNode, string memory tag) private {
        bytes32 tagHash = keccak256(bytes(tag));
        address _tagOwner = tagOwner(guildEnsNode, tagHash);

        // check that tag exists
        if (_tagOwner == address(0)) {
            revert RevokeUnauthorized();
        }

        // clear the ENS record for the tag
        _guildsResolver.setEnsForwardRecord(guildEnsNode, tag, address(0));

        // clear the token ownership for the tag
        _burnGuildToken(guildEnsNode, tagHash, _tagOwner);

        // inform the auth policy of the revocation
        ITagsAuthPolicy auth = guilds[guildEnsNode].tagsAuthPolicy;
        if (address(auth) != address(0)) {
            auth.onTagRevoked(_msgSender(), _tagOwner, guildEnsNode, tag);
        }

        emit TagRevoked(guildEnsNode, tagHash);
    }

    function _handleClaimFee(bytes32 guildEnsNode, string calldata tag, bytes calldata extraClaimArgs) internal {
        (address feeToken, uint256 fee, address feePaidTo) = guilds[guildEnsNode].feePolicy.tagClaimFee(
            guildEnsNode,
            tag,
            _msgSender(),
            extraClaimArgs
        );
        if (fee != 0) {
            if (feeToken == address(0)) {
                if (msg.value != fee) {
                    revert FeeError();
                }
                // solhint-disable-next-line avoid-low-level-calls
                (bool sent, ) = feePaidTo.call{ value: msg.value }("");
                if (!sent) revert FeeError();
            } else {
                try IERC20(feeToken).transferFrom(_msgSender(), feePaidTo, fee) returns (bool sent) {
                    if (!sent) revert FeeError();
                } catch {
                    revert FeeError();
                }
            }
        }
    }

    function _setResolverForGuild(bytes32 guildEnsNode, address resolver) internal {
        if (guilds[guildEnsNode].usesNameWrapper) {
            _nameWrapper.setResolver(guildEnsNode, resolver);
        } else {
            _ensRegistry.setResolver(guildEnsNode, resolver);
        }
    }
}
