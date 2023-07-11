# ENS Guilds

ENS Guilds allows communities to collectively share an ENS name and claim tags as sub-records of that name, broadcasting
their membership within that community.

- [ENS Guilds](#ens-guilds)
  - [How It Works](#how-it-works)
    - [The Basic Flow](#the-basic-flow)
    - [Claiming a Tag](#claiming-a-tag)
    - [Setting Up a Guild](#setting-up-a-guild)
    - [Customizing Fees and Auth](#customizing-fees-and-auth)
    - [Resolving ENS Address Lookups](#resolving-ens-address-lookups)
    - [ENS Under the Hood](#ens-under-the-hood)
    - [Moderation and Revocation](#moderation-and-revocation)
    - [ENS Reverse Records](#ens-reverse-records)
    - [Protecting Existing Sub-Names](#protecting-existing-sub-names)
  - [Dynamic ENS Resolution](#dynamic-ens-resolution)
  - [Risk Surface](#risk-surface)
  - [Decentralization and Governance](#decentralization-and-governance)
  - [ENS Name Wrapper Compatibility](#ens-name-wrapper-compatibility)
  - [Deployed Contract Addresses](#deployed-contract-addresses)

## How It Works

Guild tags are the way users claim sub-names under a Guild's top-level ENS name.

As an example, an account participating in a Guild named `punks.eth` might claim the tag "foo" for their address,
granting them the ENS name `foo.punks.eth`.

### The Basic Flow

1. The owner of an ENS name authorizes the shared ENSGuilds contract to update ENS records on their behalf (see
   [Risks](#risks))
2. The ENS name owner registers a new Guild with that name on the ENSGuilds contract
3. Accounts can claim custom tags within the Guild, and the correct ENS address records will be set for their tags
4. The Guild's admin account sets policies governing which accounts can claim which tags and how fees should be paid

### Claiming a Tag

An account may attempt to claim a tag within a guild by calling the `claimGuildTag` method:

```solidity
function claimGuildTag(
  string calldata guildEnsName,
  string calldata tag,
  address recipient,
  bytes calldata extraClaimArgs
) external payable;

```

The `recipient` will become the owner of that tag and their address will be registered in ENS under the full name
`{tag}.{guild-name}.eth`

`ExtraClaimArgs` is a catch-all for any additional info needed to check authorization for that specific guild (see
[Customizing Fees and Auth](#customizing-fees-and-auth)).

### Setting Up a Guild

For the ENSGuilds contract to operate it must be approved by the guild name's owner to update ENS state for the name.

The original name owner still keeps ownership of the name, and only appoints the ENSGuilds contract as an approved
manager of their names. (See [ENS documentation](https://docs.ens.domains/contract-api-reference/ens#set-approval)). The
name owner may revoke ENSGuilds's privileges and update or delete any ENS records it has created. If name ownership
changes after guild registration, the new owner must re-approve ENSGuilds as a manager.

A Guild may be registered for top-level `.eth` names (`some-project.eth`) or for sub-names at any depth
(`team.some-project.eth`).

When registering the new Guild the name owner appoints an admin for the guild, which can be the name owner itself. They
must also provide an initial `TagsAuthPolicy` and `FeePolicy` for their specific guild, which combined will govern
whether an account may claim or revoke any guild tag.

### Customizing Fees and Auth

The ENSGuilds contract uses a modular design to allow individual Guilds to set their own fee and auth policies for tags
while sharing the basic plumbing needed to properly integrate with ENS.

Each Guild stores the address of a contract implementing `IFeePolicy` and the address of a contract implementing
`ITagsAuthPolicy`.

Guilds may build and use their own bespoke `IFeePolicy` and `ITagsAuthPolicy` implementations or can use an existing one
built to support multiple Guilds (see [Deployed Contract Addresses](#deployed-contract-addresses)).

Fee policies are simple:

```solidity
interface IFeePolicy is IERC165 {
  function tagClaimFee(
    bytes32 guildHash,
    string calldata tag,
    address claimant,
    bytes calldata extraClaimArgs
  ) external view returns (address tokenContract, uint256 fee, address feePaidTo);
}

```

Implementations check how much the `claimant` must pay to mint the given `tag` for the given guild, returning the info
on what token type must be paid, how much, and where payment should be routed.

The simple `FlatFeePolicy` deployed by the ENSGuilds project should work for most cases, as it covers both free and paid
mints and allows only the Guild admin to set or update their specific Guild's fee amount.

Auth policies must implement these hooks:

```solidity
interface ITagsAuthPolicy is IERC165 {
  function canClaimTag(
    bytes32 guildEnsNode,
    string calldata tag,
    address claimant,
    address recipient,
    bytes calldata extraClaimArgs
  ) external view returns (bool);

  function canRevokeTag(
    address revokedBy,
    bytes32 guildEnsNode,
    string calldata tag,
    bytes calldata extraRevokeArgs
  ) external view returns (bool);

  function canTransferTag(
    bytes32 guildEnsNode,
    string calldata tag,
    address transferredBy,
    address currentOwner,
    address newOwner,
    bytes calldata extraTransferArgs
  ) external view returns (bool);
}

```

The ENSGuilds project provides three `ITagsAuthPolicy` implementations: one that allows any account to claim any
unclaimed tag, one that checks allowlists, and one that checks for NFT ownership.

Other custom `ITagsAuthPolicy` implementations might, for example, use a commit-reveal scheme to prevent front-running,
check results of an auction, or verify a custom ZKP.

### Resolving ENS Address Lookups

When a user claims a tag, a corresponding ENS record is registered resolving their full tag name to the address the user
provided. Any tool that resolves ENS address records will resolve their tag as expected.

ENSGuilds assigns itself ownership of all ENS records it creates. By design, a users cannot edit or delete a Guild's ENS
records without using the ENSGuilds contract itself.

Reverse ENS records are not managed by ENSGuilds, and must be set by the owner of a tag (see
[ENS Reverse Records](#ens-reverse-records)).

Other ENS record types beyond `Address` records are not supported.

Only the `.eth` top-level domain is supported.

### ENS Under the Hood

The ENS stack is composed of Registries, Resolvers, and Records. Registries govern ownership of names an allows users to
set Resolvers for their names, Resolvers answer queries about names, and Records describe the types of questions that
can be asked of a name.

In practice there is a single Registry for the `.eth` domain where users register `.eth` names and set the Resolvers for
their sub-names. There are a few Public Resolvers provided by ENS that most names will use by default. Users use their
PublicResolver to set the Records for their names, with `address` being the most commonly used record type.

The ENSGuilds contract updates the `.eth` Registry when a tag is claimed and sets itself as the Resolver for the tag's
full name.

Note that the ENSGuilds contract does not check the
[normalization](https://docs.ens.domains/contract-api-reference/name-processing#normalising-names) on names provided in
contract calls.

### Moderation and Revocation

ENSGuilds provides two mechanisms for moderating and revoking tag names:

1. A Guild's `TagsAuthPolicy` implementation may impose any arbitrary rules governing when a tag may be claimed
   (supporting moderation prior to claims) and when tags may be revoked (moderation post-claims)
1. As an option of last resort, the owner of the Guild's ENS name can call the `.ens` Registry out-of-band to edit or
   delete any of the Guild's sub-names at any point

### ENS Reverse Records

Accounts may set a Guild tag as their "Primary Name" using the ENS app, just as they would for any other name. More
background on ENS Primary Names [here](https://support.ens.domains/en/articles/7890756-the-primary-name).

### Protecting Existing Sub-Names

TODO

## Dynamic ENS Resolution

Some Guilds may find it useful for sub-names to be automatically and dynamically assigned to addresses, without need for
manually claiming each as a tag. As an example, a Guild centered around a specific NFT project may choose to
automatically assign a name to each token owner derived from a feature of their token (such as `punk-123.punks.eth`)

Guilds can register a wildcard resolver for their domain, which may incorporate any arbitrary logic for resolving
sub-names of the Guild. Accounts can choose to set their Primary Name to one of these dynamically assigned names if they
like.

When using a wildcard resolver, a Guild should be mindful of the potential for name collisions between the wildcard
resolver and the tags that users have claimed or may later claim. Manually claimed tags will supersede wildcard resolver
names. The Guild's `TagsAuthPolicy` should be aware of possible name collisions and permit or prevent them.

A wildcard resolver should implement
[the ENS standard](https://docs.ens.domains/ens-improvement-proposals/ensip-10-wildcard-resolution) for wildcard
resolvers (the `IExtendedResolver` interface).

The ENS Guilds project provides a wildcard resolver that will resolve names of the form `{token-id}.{guild-name}.eth`
where `token-id` is the ID of an ERC721 token.

Note that there is a special case when a Guild would like to use wildcard names and set records on the top-level Guild
name itself. As an example, consider an NFT project which uses an address record at `{guild-name}.eth` to point to the
Guild's NFT token contract and registers a wildcard resolver to resolve names of the form `{token-id}.{guild-name}.eth`.
A `PassthroughResolver` is provided by the ENS Guilds project to preserve records that were set at the top level
`{guild-name}.eth`.

## Risk Surface

The ENSGuilds contract, as a manager of each Guild's name, is limited to CRUD operations on the Guild's top-level name
and all sub-names. As a manager, it cannot change the owner of the top-level ENS name, nor edit the set of managers.

The ENS name owner is the ultimate authority, and retains the ability to revoke the ENSGuild contract's authorization
and edit any records it created. Note that a name owner may be exposed to a large cumulative gas expense to clear
potentially many sub-names.

The appointed admin account for each Guild may edit the Guild's configuration, deactivate or deregister it, and alter
the Guild's `FeePolicy` and `TagsAuthPolicy`. Teams may choose to use the same account as ENS name owner and Guild admin
for simplicity, or separate the name owner from the Guild admin for more granular separation of capabilities.

There is a nuance in the ENS Registry's delegation systems in that approving a contract as a manager will authorize it
to make changes to all names owned by the caller. It is recommended to not co-mingle ownership of multiple top-level ENS
names in the same account, as a measure to limit the scope of risk exposure across multiple names.

## Decentralization and Governance

To achieve community governance of a Guild, it is recommended to use the ENS name owner and the Guild's admin account as
hooks for existing governance stacks. For example, a Guild may transfer ownership of its ENS name to a multisig or to
any pre-made governance contract, also designating that address as the Guild's admin, to achieve decentralization.

To assist with calculating voting power, the ENSGuilds contract implements the ERC1155 token standard. Each guild is
assigned its own token ID derived from the Guild's ENS namehash, and each account is given a balance of that token equal
to the number of tags it owns.

## ENS Name Wrapper Compatibility

TODO: (Fuses, expiry)

## Deployed Contract Addresses

- [ENSGuilds contract](https://app.ens.domains/ensguilds.eth?tab=records)
- Off-the-shelf Fee and TagAuth policies [here](https://app.ens.domains/policies.ensguilds.eth?tab=subnames)
