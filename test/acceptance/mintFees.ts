import { expect } from "chai";
import { parseEther } from "ethers/lib/utils";
import { deployments, ethers, getNamedAccounts } from "hardhat";

import { IERC20__factory } from "../../types";
import { asAccount } from "../utils";

const WETH_ADDR = "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2";
const ethAddr = ethers.constants.AddressZero;

export function testMintFees(): void {
  describe("Mint Fees", function () {
    const tagToMint = "test";

    beforeEach("setup", async function () {
      const { ensRegistry, ensGuilds } = this.deployedContracts;
      const { ensNameOwner } = this.guildInfo;

      await asAccount(ensNameOwner, async (signer) => {
        // Set ENSGuilds contract as an approved operator
        await ensRegistry.connect(signer).setApprovalForAll(ensGuilds.address, true);
      });
    });

    it("Domain owner can set the fee policy when registering a new guild", async function () {
      const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;

      await asAccount(ensNameOwner, async (signer) => {
        // Register guild
        await ensGuilds.connect(signer).registerGuild(ensNode, admin, flatFeePolicy.address, openAuthPolicy.address);
      });
    });

    it("Domain owner can specify a beneficial address to receive fee payments", async function () {
      const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { minter } = this.addresses;
      const feeBeneficiary = ethers.Wallet.createRandom();

      const fee = parseEther("1");

      await asAccount(ensNameOwner, async (signer) => {
        // Register guild
        await ensGuilds.connect(signer).registerGuild(ensNode, admin, flatFeePolicy.address, openAuthPolicy.address);
      });

      // setup fee policy
      await asAccount(admin, async (signer) => {
        await flatFeePolicy.connect(signer).setFlatFee(ensNode, ethAddr, fee, feeBeneficiary.address);
      });

      // mint a tag
      await asAccount(minter, async (signer) => {
        await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, [], { value: fee });
      });

      // check that beneficiary got the fee
      const beneficiaryBalance = await ethers.provider.getBalance(feeBeneficiary.address);
      expect(beneficiaryBalance.toString()).to.eq(fee.toString());
    });

    it("Domain owner can specify fees as ETH denominated", async function () {
      const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { minter } = this.addresses;
      const feeBeneficiary = ethers.Wallet.createRandom();

      const fee = parseEther("1");

      await asAccount(ensNameOwner, async (signer) => {
        // Register guild
        await ensGuilds.connect(signer).registerGuild(ensNode, admin, flatFeePolicy.address, openAuthPolicy.address);
      });

      // setup fee policy
      await asAccount(admin, async (signer) => {
        await flatFeePolicy.connect(signer).setFlatFee(ensNode, ethAddr, fee, feeBeneficiary.address);
      });

      // mint a tag
      await asAccount(minter, async (signer) => {
        await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, [], { value: fee });
      });

      // check that beneficiary got the fee
      const beneficiaryBalance = await ethers.provider.getBalance(feeBeneficiary.address);
      expect(beneficiaryBalance.toString()).to.eq(fee.toString());
    });

    it("Domain owner can specify fees as ERC20 denominated", async function () {
      const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { minter } = this.addresses;
      const fee = parseEther("1");
      const feeBeneficiary = ethers.Wallet.createRandom();

      const weth = IERC20__factory.connect(WETH_ADDR, ethers.provider);

      // fund the minter with some WETH, from the WETH contract itself
      // (which happens to hold a bunch of WETH)
      await asAccount(WETH_ADDR, async (signer) => {
        await weth.connect(signer).transfer(minter, fee);
      });

      await asAccount(ensNameOwner, async (signer) => {
        // Register guild
        await ensGuilds.connect(signer).registerGuild(ensNode, admin, flatFeePolicy.address, openAuthPolicy.address);
      });

      // setup fee policy
      await asAccount(admin, async (signer) => {
        await flatFeePolicy.connect(signer).setFlatFee(ensNode, WETH_ADDR, fee, feeBeneficiary.address);
      });

      // mint a tag
      await asAccount(minter, async (signer) => {
        // approve ENSGuilds to take the fee
        await weth.connect(signer).approve(ensGuilds.address, fee);

        // mint
        await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, [], { value: fee });
      });

      // check that beneficiary got the fee
      const beneficiaryBalance = await weth.balanceOf(feeBeneficiary.address);
      expect(beneficiaryBalance.toString()).to.eq(fee.toString());
    });

    it("Domain owner can make minting free", async function () {
      const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { minter } = this.addresses;
      const feeBeneficiary = ethers.Wallet.createRandom();

      const fee = parseEther("0");

      await asAccount(ensNameOwner, async (signer) => {
        // Register guild
        await ensGuilds.connect(signer).registerGuild(ensNode, admin, flatFeePolicy.address, openAuthPolicy.address);
      });

      // setup fee policy
      await asAccount(admin, async (signer) => {
        await flatFeePolicy.connect(signer).setFlatFee(ensNode, ethAddr, fee, feeBeneficiary.address);
      });

      // mint a tag with no ETH attached to the tx
      await asAccount(minter, async (signer) => {
        await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, []);
      });
    });

    it("Minter can get a fee quote before they mint", async function () {
      const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { minter } = this.addresses;
      const feeBeneficiary = ethers.Wallet.createRandom();

      const fee = parseEther("1");

      await asAccount(ensNameOwner, async (signer) => {
        // Register guild
        await ensGuilds.connect(signer).registerGuild(ensNode, admin, flatFeePolicy.address, openAuthPolicy.address);
      });

      // setup fee policy
      await asAccount(admin, async (signer) => {
        await flatFeePolicy.connect(signer).setFlatFee(ensNode, ethAddr, fee, feeBeneficiary.address);
      });

      // get a quote for the fee
      const quote = await flatFeePolicy.tagClaimFee(ensNode, tagToMint, minter, []);

      // mint a tag
      await asAccount(minter, async (signer) => {
        await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, [], { value: fee });
      });

      // check that beneficiary was paid the quoted fee
      const beneficiaryBalance = await ethers.provider.getBalance(feeBeneficiary.address);
      expect(beneficiaryBalance.toString()).to.eq(quote.fee.toString());
    });

    it("Fees denominated in ETH are collected correctly", async function () {
      const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { minter } = this.addresses;
      const feeBeneficiary = ethers.Wallet.createRandom();

      const fee = parseEther("1");

      await asAccount(ensNameOwner, async (signer) => {
        // Register guild
        await ensGuilds.connect(signer).registerGuild(ensNode, admin, flatFeePolicy.address, openAuthPolicy.address);
      });

      // setup fee policy
      await asAccount(admin, async (signer) => {
        await flatFeePolicy.connect(signer).setFlatFee(ensNode, ethAddr, fee, feeBeneficiary.address);
      });

      // mint a tag with ETH attached to the tx
      await asAccount(minter, async (signer) => {
        await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, [], { value: fee });
      });

      // check that beneficiary got the ETH fee
      const beneficiaryBalance = await ethers.provider.getBalance(feeBeneficiary.address);
      expect(beneficiaryBalance.toString()).to.eq(fee.toString());
    });

    it("Fees denominated in ERC20 are collected correctly", async function () {
      const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { minter } = this.addresses;
      const fee = parseEther("1");
      const feeBeneficiary = ethers.Wallet.createRandom();

      const weth = IERC20__factory.connect(WETH_ADDR, ethers.provider);

      // fund the minter with some WETH, from the WETH contract itself
      // (which happens to hold a bunch of WETH)
      await asAccount(WETH_ADDR, async (signer) => {
        await weth.connect(signer).transfer(minter, fee);
      });

      await asAccount(ensNameOwner, async (signer) => {
        // Register guild
        await ensGuilds.connect(signer).registerGuild(ensNode, admin, flatFeePolicy.address, openAuthPolicy.address);
      });

      // setup fee policy
      await asAccount(admin, async (signer) => {
        await flatFeePolicy.connect(signer).setFlatFee(ensNode, WETH_ADDR, fee, feeBeneficiary.address);
      });

      // mint a tag
      await asAccount(minter, async (signer) => {
        // approve ENSGuilds to take the fee
        await weth.connect(signer).approve(ensGuilds.address, fee);

        // mint
        await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, [], { value: fee });
      });

      // check that beneficiary got the fee
      const beneficiaryBalance = await weth.balanceOf(feeBeneficiary.address);
      expect(beneficiaryBalance.toString()).to.eq(fee.toString());
    });

    it("Free mints behave as expected", async function () {
      const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;
      const { minter } = this.addresses;
      const feeBeneficiary = ethers.Wallet.createRandom();

      const fee = parseEther("0");

      await asAccount(ensNameOwner, async (signer) => {
        // Register guild
        await ensGuilds.connect(signer).registerGuild(ensNode, admin, flatFeePolicy.address, openAuthPolicy.address);
      });

      // setup fee policy
      await asAccount(admin, async (signer) => {
        await flatFeePolicy.connect(signer).setFlatFee(ensNode, ethAddr, fee, feeBeneficiary.address);
      });

      // mint a tag with no ETH attached to the tx
      await asAccount(minter, async (signer) => {
        await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, []);
      });
    });

    it("Domain owner can't register nonexistent or invalid contract as the fee policy for a guild", async function () {
      const { ensGuilds, openAuthPolicy } = this.deployedContracts;
      const { ensNameOwner, ensNode, admin } = this.guildInfo;

      await asAccount(ensNameOwner, async (signer) => {
        // Attempt to set zero address as the fee policy should fail
        let tx = ensGuilds
          .connect(signer)
          .registerGuild(ensNode, admin, ethers.constants.AddressZero, openAuthPolicy.address);
        await this.expectRevertedWithCustomError(tx, "InvalidPolicy");

        // Attempt to use an existing contract that doesn't implement FeePolicy
        tx = ensGuilds.connect(signer).registerGuild(ensNode, admin, openAuthPolicy.address, openAuthPolicy.address);
        await this.expectRevertedWithCustomError(tx, "InvalidPolicy");
        tx = ensGuilds.connect(signer).registerGuild(ensNode, admin, ensGuilds.address, openAuthPolicy.address);
        await this.expectRevertedWithCustomError(tx, "InvalidPolicy");

        // Attempt to use an EOA as the FeePolicy
        tx = ensGuilds.connect(signer).registerGuild(ensNode, admin, ensNameOwner, openAuthPolicy.address);
        await this.expectRevertedWithCustomError(tx, "InvalidPolicy");
      });
    });

    describe("Inability to pay fee causes a minting TX to revert", function () {
      describe("for ETH denominated fees", function () {
        it("due to too little ETH attached to claim TX", async function () {
          const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
          const { ensNameOwner, ensNode, admin } = this.guildInfo;
          const { minter } = this.addresses;
          const feeBeneficiary = ethers.Wallet.createRandom();

          const fee = parseEther("1");

          await asAccount(ensNameOwner, async (signer) => {
            // Register guild
            await ensGuilds
              .connect(signer)
              .registerGuild(ensNode, admin, flatFeePolicy.address, openAuthPolicy.address);
          });

          // setup fee policy
          await asAccount(admin, async (signer) => {
            await flatFeePolicy.connect(signer).setFlatFee(ensNode, ethAddr, fee, feeBeneficiary.address);
          });

          // mint a tag but pay only half the fee
          await asAccount(minter, async (signer) => {
            const tx = ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, [], { value: fee.div(2) });
            await this.expectRevertedWithCustomError(tx, "FeeError");
          });
        });

        it("due to too much ETH attached to claim TX", async function () {
          const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
          const { ensNameOwner, ensNode, admin } = this.guildInfo;
          const { minter } = this.addresses;
          const feeBeneficiary = ethers.Wallet.createRandom();

          const fee = parseEther("1");

          await asAccount(ensNameOwner, async (signer) => {
            // Register guild
            await ensGuilds
              .connect(signer)
              .registerGuild(ensNode, admin, flatFeePolicy.address, openAuthPolicy.address);
          });

          // setup fee policy
          await asAccount(admin, async (signer) => {
            await flatFeePolicy.connect(signer).setFlatFee(ensNode, ethAddr, fee, feeBeneficiary.address);
          });

          // mint a tag but try to pay double the fee
          await asAccount(minter, async (signer) => {
            const tx = ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, [], { value: fee.mul(2) });
            await this.expectRevertedWithCustomError(tx, "FeeError");
          });
        });

        it("due to beneficiary rejecting payment", async function () {
          const { deploy } = deployments;
          const { deployer } = await getNamedAccounts();
          const payableContractDeployment = await deploy("PayableContract", {
            from: deployer,
            autoMine: true,
          });
          const nonPayableContractDeployment = await deploy("NonPayableContract", {
            from: deployer,
            autoMine: true,
          });

          const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
          const { ensNameOwner, ensNode, admin } = this.guildInfo;
          const { minter } = this.addresses;

          const fee = parseEther("1");

          await asAccount(ensNameOwner, async (signer) => {
            // Register guild
            await ensGuilds
              .connect(signer)
              .registerGuild(ensNode, admin, flatFeePolicy.address, openAuthPolicy.address);
          });

          // setup fee policy with a non-payable contract as the beneficiary
          await asAccount(admin, async (signer) => {
            await flatFeePolicy.connect(signer).setFlatFee(ensNode, ethAddr, fee, nonPayableContractDeployment.address);
          });

          // attempt to mint a tag with ETH attached to the tx
          await asAccount(minter, async (signer) => {
            const tx = ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, [], { value: fee });
            await this.expectRevertedWithCustomError(tx, "FeeError");
          });

          // sanity-check that changing the beneficiary to a payable contract does work
          await asAccount(admin, async (signer) => {
            await flatFeePolicy.connect(signer).setFlatFee(ensNode, ethAddr, fee, payableContractDeployment.address);
          });
          await asAccount(minter, async (signer) => {
            await ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, [], { value: fee });
          });
          const beneficiaryBalance = await ethers.provider.getBalance(payableContractDeployment.address);
          expect(beneficiaryBalance.toString()).to.eq(fee.toString());
        });
      });
      describe("for ERC20 denominated fees", function () {
        it("due to insufficient ERC20 approval", async function () {
          const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
          const { ensNameOwner, ensNode, admin } = this.guildInfo;
          const { minter } = this.addresses;
          const fee = parseEther("1");
          const feeBeneficiary = ethers.Wallet.createRandom();

          const weth = IERC20__factory.connect(WETH_ADDR, ethers.provider);

          // fund the minter with some WETH, from the WETH contract itself
          // (which happens to hold a bunch of WETH)
          await asAccount(WETH_ADDR, async (signer) => {
            await weth.connect(signer).transfer(minter, fee);
          });

          await asAccount(ensNameOwner, async (signer) => {
            // Register guild
            await ensGuilds
              .connect(signer)
              .registerGuild(ensNode, admin, flatFeePolicy.address, openAuthPolicy.address);
          });

          // setup fee policy
          await asAccount(admin, async (signer) => {
            await flatFeePolicy.connect(signer).setFlatFee(ensNode, WETH_ADDR, fee, feeBeneficiary.address);
          });

          // mint a tag
          await asAccount(minter, async (signer) => {
            // approve ENSGuilds to take the less than the whole fee
            await weth.connect(signer).approve(ensGuilds.address, fee.div(2));

            // mint
            const tx = ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, [], { value: fee });
            await this.expectRevertedWithCustomError(tx, "FeeError");
          });
        });

        it("due to insufficient balance", async function () {
          const { ensGuilds, flatFeePolicy, openAuthPolicy } = this.deployedContracts;
          const { ensNameOwner, ensNode, admin } = this.guildInfo;
          const { minter } = this.addresses;
          const fee = parseEther("1");
          const feeBeneficiary = ethers.Wallet.createRandom();

          const weth = IERC20__factory.connect(WETH_ADDR, ethers.provider);

          // fund the minter with less than the required amount of WETH
          await asAccount(WETH_ADDR, async (signer) => {
            await weth.connect(signer).transfer(minter, fee.div(2));
          });

          await asAccount(ensNameOwner, async (signer) => {
            // Register guild
            await ensGuilds
              .connect(signer)
              .registerGuild(ensNode, admin, flatFeePolicy.address, openAuthPolicy.address);
          });

          // setup fee policy
          await asAccount(admin, async (signer) => {
            await flatFeePolicy.connect(signer).setFlatFee(ensNode, WETH_ADDR, fee, feeBeneficiary.address);
          });

          // mint a tag
          await asAccount(minter, async (signer) => {
            // approve ENSGuilds to take the less than the whole fee
            await weth.connect(signer).approve(ensGuilds.address, fee);

            // mint
            const tx = ensGuilds.connect(signer).claimGuildTag(ensNode, tagToMint, minter, [], { value: fee });
            await this.expectRevertedWithCustomError(tx, "FeeError");
          });
        });
      });
    });
  });
}
