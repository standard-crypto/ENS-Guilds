import { expect } from "chai";
import { type BytesLike, namehash } from "ethers";
import { ethers, getNamedAccounts } from "hardhat";

import { type ENS, type TestERC721, TestERC721__factory } from "../../../types";
import { resolveAddr, resolveText } from "../../../utils";
import { asAccount } from "../../utils";

export function testDigidaigaku(): void {
  let digisDomain: string;
  let digisHash: BytesLike;
  let digisDomainOwner: string;
  let ens: ENS;
  let digisContract: TestERC721;

  describe("Digidaigaku Integration", function () {
    beforeEach("Configure ENS Guild for Digidaigaku domain", async function () {
      const { digisTokenContract } = await getNamedAccounts();
      const { ensGuilds, digidaigakuResolver, flatFeePolicy, allowlistAuthPolicy, ensRegistry } =
        this.deployedContracts;
      const { admin } = this.guildInfo;

      // Set up digis domain
      digisDomain = "digidaigaku.eth";
      digisHash = namehash(digisDomain);
      ens = await ethers.getContractAt("ENS", ensRegistry);
      digisDomainOwner = await ens.owner(namehash(digisDomain));

      // connect to digis token contract
      digisContract = TestERC721__factory.connect(digisTokenContract, ensGuilds.runner);

      // Set up Guild for digidaigaku.eth
      // 1. Name owner sets ENSGuilds contract as an ENS operator
      await asAccount(digisDomainOwner, async (signer) => {
        await ensRegistry.connect(signer).setApprovalForAll(ensGuilds.getAddress(), true);
      });

      // 2. Name owner registers digidaigaku.eth as a new guild
      await asAccount(digisDomainOwner, async (signer) => {
        // Register guild
        await ensGuilds
          .connect(signer)
          .registerGuild(digisDomain, admin, flatFeePolicy.getAddress(), allowlistAuthPolicy.getAddress());
      });

      // 3. Guild admin registers DigidaigakuResolver as the fallback resolver for the digidaigaku.eth guild
      await asAccount(admin, async (signer) => {
        await ensGuilds.connect(signer).setFallbackResolver(digisHash, digidaigakuResolver.getAddress());
      });
    });

    it("tries to resolve with a token id", async function () {
      const digiId = 438;
      const digiOwner = await digisContract.ownerOf(digiId);

      // Check that 438.digidaigaku.eth resolves to the address of the owner
      const resolvedAddr = await resolveAddr(ens, `${digiId}.${digisDomain}`);
      expect(resolvedAddr).to.eq(digiOwner);
    });

    it("tries to resolve with a name [ @skip-on-coverage ]", async function () {
      const digiId = 523;
      const digiName = "addie";
      const digiOwner = await digisContract.ownerOf(digiId);

      // Check that addie.digidaigaku.eth resolves to the address of the owner
      const resolvedAddr = await resolveAddr(ens, `${digiName}.${digisDomain}`, { enableCcip: true });
      expect(resolvedAddr).to.eq(digiOwner);
    });

    it("tries to resolve a text record with a token id", async function () {
      const digiId = 438;
      const expectedUrlTxtRecord = `https://digidaigaku.com/metadata/${digiId}.json`;
      const urlTxtRecord = await resolveText(ens, `${digiId}.${digisDomain}`, "url");
      expect(urlTxtRecord).to.eq(expectedUrlTxtRecord);
    });

    it("tries to resolve a text record with a name", async function () {
      const digiName = "addie";
      const digiId = 523;
      const expectedUrlAvatarRecord = `eip155:1/erc721:0xd1258db6ac08eb0e625b75b371c023da478e94a9/${digiId}`;
      const avatarTxtRecord = await resolveText(ens, `${digiName}.${digisDomain}`, "avatar", { enableCcip: true });
      expect(avatarTxtRecord).to.eq(expectedUrlAvatarRecord);
    });
  });
}
