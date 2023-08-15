import { testENSGuildsHumanized } from "./ensGuilds/mixins/ENSGuildsHumanized";
import { testErc721WildcardResolver } from "./ensWildcardResolvers/Erc721WildcardResolver";
import { testWildcardResolverBase } from "./ensWildcardResolvers/WildcardResolverBase";
import { testENSParentName } from "./libraries/ENSParentName";

describe("Unit Tests - Contracts", function () {
  testENSGuildsHumanized.bind(this)();
  testENSParentName.bind(this)();
  testErc721WildcardResolver.bind(this)();
  testWildcardResolverBase.bind(this)();
});
