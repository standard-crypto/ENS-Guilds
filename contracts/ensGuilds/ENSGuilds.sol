// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@ensdomains/ens-contracts/contracts/registry/ENS.sol";

import "./interfaces/IENSGuilds.sol";
import "../feePolicies/FeePolicy.sol";
import "../tagsAuthPolicies/ITagsAuthPolicy.sol";
import "./mixins/GuildTagResolver.sol";
import "./mixins/GuildTagTokens.sol";
import "./mixins/ENSGuildsHumanized.sol";

contract ENSGuilds is IENSGuilds, ENSGuildsHumanized, GuildTagTokens, GuildTagResolver, ReentrancyGuard {
    struct GuildInfo {
        address admin;
        FeePolicy feePolicy;
        ITagsAuthPolicy tagsAuthPolicy;
        bool active;
        bool deregistered;
    }

    using ERC165Checker for address;

    /** State */
    ENS public immutable ensRegistry;
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
    error InvalidWildcardResolver();

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

    constructor(string memory defaultTokenMetadataUri, ENS _ensRegistry) ERC1155(defaultTokenMetadataUri) {
        ensRegistry = _ensRegistry;
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(GuildTagResolver, GuildTagTokens, IERC165) returns (bool) {
        return
            interfaceId == type(IENSGuilds).interfaceId ||
            GuildTagResolver.supportsInterface(interfaceId) ||
            GuildTagTokens.supportsInterface(interfaceId) ||
            ERC165.supportsInterface(interfaceId);
    }

    /**
     * @inheritdoc IENSGuilds
     */
    function registerGuild(
        bytes32 ensNode,
        address admin,
        address feePolicy,
        address tagsAuthPolicy
    ) public override(ENSGuildsHumanized, IENSGuilds) {
        // Check caller is owner of domain
        if (ensRegistry.owner(ensNode) != _msgSender()) {
            revert NotDomainOwner();
        }

        // Check guild not yet registered
        if (address(guilds[ensNode].feePolicy) != address(0)) {
            revert AlreadyRegistered();
        }

        // Check ENSGuilds contract has been approved to edit the ENS registry on behalf of the caller
        if (!ensRegistry.isApprovedForAll(_msgSender(), address(this))) {
            revert ENSGuildsIsNotRegisteredOperator();
        }

        // Check for valid fee/tagsAuth policies
        if (!feePolicy.supportsInterface(type(FeePolicy).interfaceId)) {
            revert InvalidPolicy(feePolicy);
        }
        if (!tagsAuthPolicy.supportsInterface(type(ITagsAuthPolicy).interfaceId)) {
            revert InvalidPolicy(tagsAuthPolicy);
        }

        guilds[ensNode] = GuildInfo({
            admin: admin,
            feePolicy: FeePolicy(feePolicy),
            tagsAuthPolicy: ITagsAuthPolicy(tagsAuthPolicy),
            active: true,
            deregistered: false
        });

        emit Registered(ensNode);
    }

    /**
     * @inheritdoc IENSGuilds
     */
    function deregisterGuild(
        bytes32 ensNode
    ) public override(ENSGuildsHumanized, IENSGuilds) onlyGuildAdmin(ensNode) requireGuildRegistered(ensNode) {
        delete guilds[ensNode];
        guilds[ensNode].deregistered = true;
        guilds[ensNode].active = false;
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
        bytes32 ensNode = keccak256(abi.encodePacked(guildEnsNode, tagHash));
        if (ensRegistry.owner(ensNode) != address(0)) {
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

        // Register this new name in ENS
        ensRegistry.setSubnodeRecord(guildEnsNode, tagHash, address(this), address(this), 0);

        // Set forward record in ENS resolver
        _setEnsForwardRecord(ensNode, recipient);

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
        bytes32 tagEnsNode = keccak256(abi.encodePacked(guildEnsNode, tagHash));
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
        _setEnsForwardRecord(tagEnsNode, recipient);

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
    ) public override(ENSGuildsHumanized, IENSGuilds) nonReentrant {
        GuildInfo storage guild = guilds[guildEnsNode];

        // All tags can be revoked from a guild that has been de-registered
        if (guild.deregistered) {
            _revokeTag(guildEnsNode, tag);
            return;
        }

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
        if (!feePolicy.supportsInterface(type(FeePolicy).interfaceId)) {
            revert InvalidPolicy(feePolicy);
        }
        guilds[guildEnsNode].feePolicy = FeePolicy(feePolicy);
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
        bytes32 tagEnsNode = keccak256(abi.encodePacked(guildEnsNode, tagHash));
        // if ENSGuilds is not the owner of the tag's ENS node, then the tag itself is not valid
        // and therefore has no owner
        if (ensRegistry.owner(tagEnsNode) != address(this)) {
            return address(0);
        }
        return addr(tagEnsNode);
    }

    /**
     * @inheritdoc IENSGuilds
     */
    function setWildcardResolver(
        bytes32 guildEnsNode,
        IExtendedResolver wildcardResolver
    ) public onlyGuildAdmin(guildEnsNode) requireGuildRegistered(guildEnsNode) {
        if (!address(wildcardResolver).supportsInterface(type(IExtendedResolver).interfaceId)) {
            revert InvalidWildcardResolver();
        }
        ensRegistry.setResolver(guildEnsNode, address(wildcardResolver));
    }

    function _revokeTag(bytes32 guildEnsNode, string memory tag) private {
        bytes32 tagHash = keccak256(bytes(tag));
        address _tagOwner = tagOwner(guildEnsNode, tagHash);

        // check that tag exists
        if (_tagOwner == address(0)) {
            revert RevokeUnauthorized();
        }

        ensRegistry.setSubnodeRecord(guildEnsNode, tagHash, address(0), address(0), 0);
        _burnGuildToken(guildEnsNode, tagHash, _tagOwner);

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
}
