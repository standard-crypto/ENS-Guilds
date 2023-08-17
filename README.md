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
    - [De-Registering Guilds](#de-registering-guilds)
    - [Setting Custom Fallback Resolvers](#setting-custom-fallback-resolvers)
  - [Risk Surface](#risk-surface)
  - [Decentralization and Governance](#decentralization-and-governance)
  - [ENS Name Wrapper Compatibility](#ens-name-wrapper-compatibility)
  - [Deployed Contract Addresses](#deployed-contract-addresses)

## How It Works

Users may claim sub-names under a Guild's top-level ENS name as "tags" within that Guild.

As an example, an account participating in a Guild named `some-project.eth` might claim the tag `alice` for their
address, granting them the ENS name `alice.some-project.eth`.

### The Basic Flow

1. The owner of an ENS name authorizes the shared ENSGuilds contract to update ENS records on their behalf
2. The ENS name owner registers a new Guild with that name via `ENSGuilds.registerGuild()`
3. Accounts can claim custom tags within the Guild and the correct ENS address records will be set for their tags
4. The Guild's admin account sets the policies governing which accounts can claim which tags and how fees should be paid

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
`{tag}.{guildEnsName}`

`ExtraClaimArgs` is a catch-all for any additional info needed to check authorization for that specific guild (see
[Customizing Fees and Auth](#customizing-fees-and-auth)).

### Setting Up a Guild

For the ENSGuilds contract to operate, it must be authorized by the Guild name's owner to update ENS state for the name.

The original name owner still keeps ownership of the name, and only appoints the ENSGuilds contract as an approved
manager of their names. (See [ENS documentation](https://docs.ens.domains/contract-api-reference/ens#set-approval)). The
name owner may revoke ENSGuilds's privileges and update or delete any ENS records it has created. If name ownership
changes after guild registration, the new owner must re-approve ENSGuilds as a manager.

A Guild may be registered for top-level `.eth` names (`some-project.eth`) or for sub-names at any depth
(`team.some-project.eth`).

When registering the new Guild the name owner appoints an admin for the guild, which can be the same address as the name
owner itself. They must also provide an initial `TagsAuthPolicy` and `FeePolicy` for their specific guild, which
combined will govern what happens when an account attempts to claim or revoke any guild tag.

### Customizing Fees and Auth

The ENSGuilds contract uses a modular design to allow individual Guilds to set their own fees and auth policies for tags
while sharing the basic plumbing needed to properly integrate with ENS.

Each Guild stores the address of a contract implementing `IFeePolicy` and the address of a contract implementing
`ITagsAuthPolicy`.

Guilds may build and use their own bespoke `IFeePolicy` and `ITagsAuthPolicy` implementations or may use any existing
ones built to support multiple Guilds simultaneously (see [Deployed Contract Addresses](#deployed-contract-addresses)).

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
on what token type must be paid (`address(0)` for ETH), how much, and where payment should be routed.

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

The ENSGuilds project provides three `ITagsAuthPolicy` implementations: one allowing any account to claim any unclaimed
tag (`OpenAuthPolicy`), one using allowlists controlled by each Guild's admin (`AllowlistAuthPolicy`), and one using NFT
ownership (`NFTAuthPolicy`).

Other custom `ITagsAuthPolicy` implementations might, for example, use a commit-reveal scheme to prevent front-running,
check results of an auction, or verify a custom ZKP.

`ExtraClaimArgs`, `extraTransferArgs`, and the like are provided to allow custom implementations to receive additional
implementation-specific details from the caller. ENSGuilds will blindly forward these arguments through to the Guild's
`FeePolicy` and `TagsAuthPolicy`; implementations are free to encode information in these bytes as they please.

### Resolving ENS Address Lookups

When a user claims a tag, a corresponding ENS record is registered resolving their full tag name (`bob.some-guild.eth`)
to the address the user provided. Any tool that resolves ENS address records will resolve their tag as expected,
provided the tool supports
[WildcardResolution](https://docs.ens.domains/ens-improvement-proposals/ensip-10-wildcard-resolution) (as most do).

By design, a users cannot edit or delete a Guild's ENS records without using the ENSGuilds contract itself.

Reverse ENS records are not managed by ENSGuilds. They must be set by the owner of a tag (see
[ENS Reverse Records](#ens-reverse-records)).

Other ENS record types beyond `Address` records are not supported, and only the `.eth` top-level domain is supported.

### ENS Under the Hood

Background: The ENS stack is composed of Registries, Resolvers, and Records. Registries govern ownership of names an
allows users to set Resolvers for their names, Resolvers answer queries about names, and Records describe the types of
questions that can be asked of a name.

In practice there is a single Registry for the `.eth` domain where users register `.eth` names and set the Resolvers for
their name and its sub-names. There are a few deployed versions of `PublicResolver` provided by ENS that most names will
use by default. Name owners interact with their PublicResolver to set the individual Records for their name and its
sub-names.

The ENSGuilds contract updates the `.eth` Registry to designate itself as the Resolver for the Guild's name and uses the
[wildcard resolution standard](https://docs.ens.domains/ens-improvement-proposals/ensip-10-wildcard-resolution) to both
resolve tag names under the Guild's name and to resolve records on the top-level Guild name itself.

As an example, consider a fictional Guild named `some-guild.eth`, owned in the `.eth` Registry by an address
`alice.eth`.

Prior to registering her name as a new Guild, `alice.eth` must first call
`ENS.setApprovalForAll(ENSGuilds.address, true)` at the ENS Registry contract, authorizing ENSGuilds to edit all of her
ENS names (but not to transfer their ownership).

She then calls `ENSGuilds.registerGuild("some-guild.eth", ...)` to launch her new Guild. While serving her request, the
ENSGuilds contract will update the `.eth` Registry via its own internal call to
`ENS.setResolver(namehash("some-guild.eth"), GuildsResolver.address)`.

The GuildsResolver contract is then responsible for resolving all records at `some-guild.eth` as well as those of any of
its subdomains, except in situations where a subdomain was already registered prior to launching her Guild.

The GuildsResolver will answer any address queries for tags claimed by users of her Guild, such as the example tag
`bob.some-guild.eth`.

If GuildsResolver receives a query that does not correspond to an existing Guild tag, it will proxy the query through to
the original Resolver that `alice.eth` had configured for her `some-guild.eth` name before its Resolver registration was
rewritten to point to `GuildsResolver`.

If `alice.eth` had registered, for example, `treasury.some-guild.eth` prior to launching her Guild, any records she set
for that on that name are preserved by the proxy.

To recap, consider these example ENS record queries:

- `addr("some-guild.eth")`: GuildsResolver will proxy this to the original Resolver of `some-guild.eth`
- `text("some-guild.eth", "avatar")`: GuildsResolver will proxy this to the original Resolver of `some-guild.eth`
- `addr("bob.some-guild.eth")`: GuildsResolver will directly answer this query, assuming `bob` is an existing tag
  claimed by a member of that Guild
- `text("bob.some-guild.eth", "avatar")`: GuildResolver will proxy this query, as Guild tags don't have text records.
- `addr("unclaimed.some-guild.eth")`: Assuming the tag `unclaimed` is indeed unclaimed for this Guild, GuildsResolver
  will proxy the query to the original Resolver of `some-guild.eth` (if that original Resolver implements the
  [wildcard resolution standard](https://docs.ens.domains/ens-improvement-proposals/ensip-10-wildcard-resolution))
- `text("unclaimed.some-guild.eth", "avatar")`: Proxied to the original Resolver
- `addr("treasury.some-guild.eth")`: GuildsResolver is not involved in resolving this name. This name was directly
  registered in the `.eth` Registry and therefore uses one of ENS's PublicResolvers to store the address record for this
  name.

Note that the ENSGuilds contract does not check the
[normalization](https://docs.ens.domains/contract-api-reference/name-processing#normalising-names) on names provided in
contract calls, especially when a user attempts to claim a tag. Applications should take care to normalize names prior
to submitting them in contract calls.

### Moderation and Revocation

ENSGuilds provides two mechanisms for moderating and revoking tag names:

1. A Guild's `TagsAuthPolicy` implementation may impose any arbitrary rules governing when a tag may be claimed
   (moderation prior to claim) and when tags may be revoked (moderation post-claim)
2. The owner of the Guild's ENS name may interact with the `.eth` Registry out-of-band to manually register the sub-name
   corresponding to any offending tag. Recall that sub-names registered directly with the `.eth` Registry will always
   take precedence over wildcard resolver results, and that GuildsResolver uses
   [wildcard resolution](https://docs.ens.domains/ens-improvement-proposals/ensip-10-wildcard-resolution) to resolve tag
   names.

### ENS Reverse Records

Accounts may set a Guild tag as their "Primary Name" using the ENS app, just as they would for any other name, though
they will not see their tags in the list of all names they own on the ENS webapp (a consequence of using wildcard
resolution). More background on ENS Primary Names
[here](https://support.ens.domains/en/articles/7890756-the-primary-name).

### De-Registering Guilds

When a Guild is de-registered, all tags for the Guild are wiped and the `.eth` Registry is reset to point back to the
original Resolver for the Guild's name. All tag names claimed under that Guild will no longer resolve to any address.

A de-registered guild may be re-registered again with the same name, in which case it launches with a clean slate of
unassigned tags.

It is the Guild admin's responsibility to manually reset any state kept by the Guild's `FeePolicy` and `TagsAuthPolicy`
once a Guild is de-registered, if it is to be re-registered again with those same policies.

### Setting Custom Fallback Resolvers

Some Guilds may find it useful for sub-names to be automatically and dynamically assigned to addresses, without need for
manually claiming each as a tag. As an example, a Guild centered around a specific NFT project may choose to
automatically assign a name to each token owner derived from a feature of their token (such as the name
`punk-123.punks.eth`)

Guilds can register a custom fallback Resolver for their domain, which may incorporate any arbitrary logic for resolving
sub-names of the Guild. Accounts can choose to set their Primary Name to one of these dynamically assigned names if they
like.

When setting a custom fallback resolver, a Guild should be mindful of the potential for name collisions between the
fallback resolver and the tags that users have claimed or may later claim. Manually claimed tags will always supersede
wildcard resolver names. The Guild's `TagsAuthPolicy` should be aware of possible name collisions and permit or prevent
them.

The ENS Guilds project provides a wildcard resolver that will resolve names of the form `{token-id}.{guild-name}.eth`
where `token-id` is the ID of an ERC721 token.

Note that this is the same mechanism used by the GuildsResolver itself to proxy any non-tag-related queries to the guild
name's original Resolver. By setting a custom fallback resolver, the Guild admin is simply rewriting the proxy target
for their particular guild.

## Risk Surface

The ENSGuilds contract, as a manager of each Guild's name, is limited to CRUD operations on the Guild's top-level name
and all sub-names.

The guild name's owner is the ultimate authority, retaining the ability to revoke the ENSGuild contract's authorization
or reset back to the original resolver for the Guild's name.

The appointed admin account for each Guild may edit the Guild's configuration, deactivate or deregister it, or alter the
Guild's `FeePolicy` or `TagsAuthPolicy`. Teams may choose to use the Guild's name owner as the Guild's admin for
simplicity, or separate the name owner from the admin for a more granular separation of capabilities.

There is a nuance in the ENS Registry's delegation system in that approving a contract as a manager will authorize it to
make changes to _all_ names owned by the caller. It is therefore recommended to not co-mingle ownership of multiple
top-level ENS names in the same account.

Furthermore, the ENS registry system technically allows a name _manager_ to transfer ownership of the name it manages,
even though the manager is not itself the _owner_. Only audit and careful code review can guarantee that the ENS Guilds
contracts will not inadvertently transfer ownership of a guild's name.

## Decentralization and Governance

To achieve community governance of a Guild, it is recommended to use the ENS name owner and the Guild's admin account as
hooks for plugging in existing governance stacks. For example, a Guild may transfer ownership of its ENS name to a
multisig or to any pre-made governance contract, also designating that address as the Guild's admin, to achieve full
decentralization.

To assist with calculating voting power, the ENSGuilds contract implements the ERC1155 token standard. Each guild is
assigned its own token ID derived from the Guild's ENS namehash, and each account is given a balance of that token equal
to the number of tags it owns.

## ENS Name Wrapper Compatibility

ENSGuilds supports both wrapped and unwrapped Guild names. In the case of wrapped ENS names, the name owner must call
`NameWrapper.setApprovalForAll(ENSGuilds.address, true)` prior to launching the Guild, instead of calling
`setApprovalForAll` on the `ENS` contract.

As ENSGuilds uses wildcard resolution for all Guild tags, it does not interact with NameWrapper's tokens nor its system
of fuses and expirations.

## Deployed Contract Addresses

- [ENSGuilds contract](https://app.ens.domains/ensguilds.eth?tab=records)
- [GuildsResolver](https://app.ens.domains/guilds.resolvers.ensguilds.eth?tab=records)
- Off-the-shelf [Fee and TagAuth policies](https://app.ens.domains/policies.ensguilds.eth?tab=subnames)
