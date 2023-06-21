import { testENSGuildsHumanized } from "./ensGuilds/mixins/ENSGuildsHumanized";
import { testErc721WildcardResolver } from "./ensWildcardResolvers/Erc721WildcardResolver";
import { testENSParentName } from "./libraries/ENSParentName";

describe("Unit Tests", function () {
  testENSGuildsHumanized.bind(this)();
  testENSParentName.bind(this)();
  testErc721WildcardResolver.bind(this)();
});
