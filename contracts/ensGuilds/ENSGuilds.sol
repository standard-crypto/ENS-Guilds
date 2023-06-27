// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import "@ensdomains/ens-contracts/contracts/registry/ENS.sol";

import "./interfaces/IENSGuilds.sol";
import "../feePolicies/FeePolicy.sol";
import "../tagsAuthPolicies/ITagsAuthPolicy.sol";
import "./mixins/ENSResolver.sol";
import "./mixins/ENSGuildsToken.sol";
import "./mixins/ENSGuildsHumanized.sol";

contract ENSGuilds is IENSGuilds, ENSGuildsHumanized, ENSGuildsToken, ENSResolver, ReentrancyGuard {
    struct GuildInfo {
        address admin;
        FeePolicy feePolicy;
        ITagsAuthPolicy tagsAuthPolicy;
        bool active;
        bool deregistered;
    }

    using ERC165Checker for address;

    /** State */
    ENS public ensRegistry;
    mapping(bytes32 => GuildInfo) public guilds;

    /** Errors */
    error AlreadyRegistered();
    error ENSGuildsIsNotRegisteredOperator();
    error NotDomainOwner();
    error InvalidPolicy(address);
    error GuildNotActive();
    error ClaimUnauthorized();
    error RevokeUnauthorized();
    error GuildAdminOnly();
    error TagAlreadyClaimed();
    error FeeError();

    modifier onlyGuildAdmin(bytes32 guildHash) {
        if (guilds[guildHash].admin != _msgSender()) {
            revert GuildAdminOnly();
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
    ) public view virtual override(ENSResolver, ENSGuildsToken, IERC165) returns (bool) {
        return
            interfaceId == type(IENSGuilds).interfaceId ||
            ENSResolver.supportsInterface(interfaceId) ||
            ENSGuildsToken.supportsInterface(interfaceId) ||
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

        // Check ENSGuilds contract has been configured as ENS resolver for the guild
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
    function deregisterGuild(bytes32 ensNode) public override(ENSGuildsHumanized, IENSGuilds) onlyGuildAdmin(ensNode) {
        delete guilds[ensNode];
        guilds[ensNode].deregistered = true;
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
    ) public payable override(ENSGuildsHumanized, IENSGuilds) nonReentrant {
        bytes32 tagHash = keccak256(bytes(tag));

        // assert guild is not frozen
        if (!guilds[guildEnsNode].active) {
            revert GuildNotActive();
        }

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

        // NFT mint
        _mintNewGuildToken(guildEnsNode, tagHash, recipient);

        // inform auth contract that tag was claimed, then revoke an existing tag if instructed
        bytes32 tagToRevoke = auth.onTagClaimed(guildEnsNode, tag, _msgSender(), recipient, extraClaimArgs);
        if (tagToRevoke != bytes32(0)) {
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

        // revoke authorized?
        ITagsAuthPolicy auth = guilds[guildEnsNode].tagsAuthPolicy;
        if (!guild.deregistered && !auth.tagCanBeRevoked(_msgSender(), guildEnsNode, tag, extraData)) {
            revert RevokeUnauthorized();
        }

        bytes32 tagHash = keccak256(bytes(tag));
        _revokeTag(guildEnsNode, tagHash);
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
    ) public override(ENSGuildsHumanized, IENSGuilds) onlyGuildAdmin(guildEnsNode) {
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
    ) public override(ENSGuildsHumanized, IENSGuilds) onlyGuildAdmin(guildEnsNode) {
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
    ) public override(ENSGuildsHumanized, IENSGuilds) onlyGuildAdmin(guildEnsNode) {
        guilds[guildEnsNode].admin = newAdmin;
        emit AdminTransferred(guildEnsNode, newAdmin);
    }

    /**
     * @inheritdoc IENSGuilds
     */
    function setGuildTokenUriTemplate(
        bytes32 guildEnsNode,
        string calldata uriTemplate
    ) public override(ENSGuildsHumanized, IENSGuilds) onlyGuildAdmin(guildEnsNode) {
        _setGuildTokenURITemplate(guildEnsNode, uriTemplate);
        emit TokenUriTemplateSet(guildEnsNode, uriTemplate);
    }

    /**
     * @inheritdoc IENSGuilds
     */
    function setGuildActive(
        bytes32 guildEnsNode,
        bool active
    ) public override(ENSGuildsHumanized, IENSGuilds) onlyGuildAdmin(guildEnsNode) {
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

    function _revokeTag(bytes32 guildEnsNode, bytes32 tagHash) private {
        address _tagOwner = tagOwner(guildEnsNode, tagHash);

        // check that tag exists
        if (_tagOwner == address(0)) {
            revert RevokeUnauthorized();
        }

        ensRegistry.setSubnodeRecord(guildEnsNode, tagHash, address(0), address(0), 0);
        _burnGuildToken(guildEnsNode, tagHash, _tagOwner);

        emit TagRevoked(guildEnsNode, tagHash);
    }
}
