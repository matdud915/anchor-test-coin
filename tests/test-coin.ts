import assert = require("assert");
import * as anchor from "@project-serum/anchor";
import { Program, ProgramError } from "@project-serum/anchor";
import { TestCoin } from "../target/types/test_coin";
const { SystemProgram, LAMPORTS_PER_SOL } = anchor.web3;
import { findProgramAddressSync } from "@project-serum/anchor/dist/cjs/utils/pubkey";
import NodeWallet from "@project-serum/anchor/dist/cjs/nodewallet";

const utf8 = anchor.utils.bytes.utf8;

describe("test-coin", async () => {
  const provider = anchor.Provider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.TestCoin as Program<TestCoin>;

  const getWallet = async () => {
    const kp = anchor.web3.Keypair.generate();
    const wallet = new NodeWallet(kp);
    await requestAirdrop(wallet.publicKey);
    return wallet;
  };

  let managerWallet: NodeWallet;

  before(async () => {
    managerWallet = await getWallet();
  });

  beforeEach(async () => {
    await requestAirdrop(provider.wallet.publicKey);
  });

  const getReturnValue = <T>(simulatedEvents: ReadonlyArray<anchor.Event>): T => {
    const data = simulatedEvents.find((x) => x.name == "ViewEvent").data as any;
    return data.value;
  };

  // const initialize = async (wallet: Wallet, signer: anchor.web3.Keypair) => {
  //   await program.rpc.initialize({
  //     accounts: {
  //       coinAccount: signer.publicKey,
  //       authority: wallet.publicKey,
  //       systemProgram: SystemProgram.programId,
  //     },
  //     signers: [signer],
  //   });
  // };

  const requestAirdrop = async (publicKey: anchor.web3.PublicKey) => {
    const transaction = await provider.connection.requestAirdrop(publicKey, LAMPORTS_PER_SOL);
    await provider.connection.confirmTransaction(transaction);
  };

  // it("new sets total_supply and coin manager", async () => {
  //   const jakisKlucz = anchor.web3.Keypair.generate();
  //   // await provider.connection.requestAirdrop(owner.publicKey, 100*LAMPORTS_PER_SOL)
  //   const wallet = new NodeWallet((provider.wallet as NodeWallet).payer)
  //   const ow2 = anchor.web3.Keypair.generate()
  //   const wallet2 = new NodeWallet(ow2)
  //   // const d3 = anchor.web3.Keypair.generate()
  //   await provider.connection.requestAirdrop(wallet2.publicKey, 100*LAMPORTS_PER_SOL)
  //   // await provider.connection.requestAirdrop(owner.publicKey, 100*LAMPORTS_PER_SOL)
  //   await provider.connection.requestAirdrop(wallet.publicKey, 100*LAMPORTS_PER_SOL)
  //   // const newPair = anchor.web3.Keypair.generate()
  //   // anchor.setProvider(new anchor.Provider(anchor.co))
  //   // provider.wallet = wallet2
  //   // program.provider.wallet = wallet2;

  //   const [seed, bump] = findProgramAddressSync([utf8.encode('settings')], program.programId)
  //   const tx = await program.rpc.new({
  //     accounts: {
  //       authority: wallet2.payer.publicKey,
  //       settings: seed,
  //       systemProgram: SystemProgram.programId,
  //     },
  //     signers: [wallet2.payer],
  //   });
  // });

  const getSettingsAddress = () => findProgramAddressSync([utf8.encode("settings")], program.programId)[0];
  const getAccountAddress = (wallet: NodeWallet) =>
    findProgramAddressSync([wallet.publicKey.toBuffer()], program.programId)[0];

  const newTx = async (authority: NodeWallet) => {
    const settingsSeed = getSettingsAddress();

    await program.rpc.new({
      accounts: {
        authority: authority.publicKey,
        settings: settingsSeed,
        systemProgram: SystemProgram.programId,
      },
      signers: [authority.payer],
    });
  };

  const initializeAccountTx = async (authority: NodeWallet) => {
    const accountAddress = getAccountAddress(authority);

    await program.rpc.initializeAccount({
      accounts: {
        coinAccount: accountAddress,
        authority: authority.publicKey,
        systemProgram: SystemProgram.programId,
      },
      signers: [authority.payer],
    });
  };

  const mintTx = async (targetAccount: NodeWallet, amount: number) => {
    const settingsAccount = getSettingsAddress();
    const accountAddress = getAccountAddress(targetAccount);

    await program.rpc.mint(new anchor.BN(amount), {
      accounts: {
        coinSettings: settingsAccount,
        authority: managerWallet.publicKey,
        targetAccount: accountAddress,
      },
      signers: [managerWallet.payer],
    });
  };

  it("new sets total_supply and coin manager", async () => {
    const settingsSeed = getSettingsAddress();

    await program.rpc.new({
      accounts: {
        authority: managerWallet.publicKey,
        settings: settingsSeed,
        systemProgram: SystemProgram.programId,
      },
      signers: [managerWallet.payer],
    });

    const settingsAccount = await program.account.coinSettings.fetch(settingsSeed);
    assert.equal(settingsAccount.authority.toString(), managerWallet.publicKey.toString());
    assert.equal(settingsAccount.totalSupply, 0);
  });

  it("new when settings account already exists should throw error", async () => {
    const managerWallet = await getWallet();
    await assert.rejects(
      () => newTx(managerWallet),
      (err: ProgramError) => {
        assert.equal(
          err.message,
          "failed to send transaction: Transaction simulation failed: Error processing Instruction 0: custom program error: 0x0"
        );
        return true;
      }
    );
  });

  it("when account is not initialized should return null", async () => {
    const wallet = await getWallet();
    const accountAddress = getAccountAddress(wallet);
    const account = await program.account.coinAccount.fetchNullable(accountAddress);
    assert.equal(account, null);
  });

  it("initialize, should initialize account", async () => {
    const wallet = await getWallet();
    const accountAddress = getAccountAddress(wallet);

    await program.rpc.initializeAccount({
      accounts: {
        coinAccount: accountAddress,
        authority: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      },
      signers: [wallet.payer],
    });

    const account = await program.account.coinAccount.fetch(accountAddress);
    assert.equal(account.authority.toString(), wallet.publicKey.toString());
    assert.equal(account.balance, 0);
  });

  it("mint when authority matches should mint coins to target account", async () => {
    const wallet = await getWallet();
    const settings = getSettingsAddress();
    const targetAccount = getAccountAddress(wallet);
    await initializeAccountTx(wallet);
    const mintAmount = 100;

    await program.rpc.mint(new anchor.BN(mintAmount), {
      accounts: {
        coinSettings: settings,
        authority: managerWallet.publicKey,
        targetAccount: targetAccount,
      },
      signers: [managerWallet.payer],
    });

    const targetAccountOnChain = await program.account.coinAccount.fetch(targetAccount);
    const coinSettingsAccountOnChain = await program.account.coinSettings.fetch(settings);

    assert.equal(targetAccountOnChain.balance.toNumber(), mintAmount);
    assert.equal(coinSettingsAccountOnChain.totalSupply.toNumber(), mintAmount);
  });

  it("mint when authority does not match should throw error", async () => {
    const wallet = await getWallet();
    const settings = getSettingsAddress();
    const targetAccount = getAccountAddress(wallet);
    await initializeAccountTx(wallet);

    await assert.rejects(
      () =>
        program.rpc.mint(new anchor.BN(100), {
          accounts: {
            coinSettings: settings,
            authority: wallet.publicKey,
            targetAccount: targetAccount,
          },
          signers: [wallet.payer],
        }),
      (err: ProgramError) => {
        assert.equal(err.msg, "A has_one constraint was violated");
        assert.equal(err.code, 2001);
        return true;
      }
    );
  });

  it("transfer when not enough amount throw error", async () => {
    const fromWallet = await getWallet();
    const toWallet = await getWallet();
    await initializeAccountTx(fromWallet);
    await initializeAccountTx(toWallet);
    const fromAddress = getAccountAddress(fromWallet);
    const toAddress = getAccountAddress(toWallet);

    await assert.rejects(
      () =>
        program.rpc.transfer(new anchor.BN(100), {
          accounts: {
            fromAccount: fromAddress,
            targetAccount: toAddress,
            authority: fromWallet.publicKey,
          },
          signers: [fromWallet.payer],
        }),
      (err: any) => {
        assert.equal(err.msg, "You have no enough coins to perform this action.");
        return true;
      }
    );
  });

  it("transfer when enough coins should transfer amount ", async () => {
    const fromWallet = await getWallet();
    const toWallet = await getWallet();
    await initializeAccountTx(fromWallet);
    await initializeAccountTx(toWallet);
    await mintTx(fromWallet, 100);
    const fromAddress = getAccountAddress(fromWallet);
    const toAddress = getAccountAddress(toWallet);

    await program.rpc.transfer(new anchor.BN(50), {
      accounts: {
        fromAccount: fromAddress,
        targetAccount: toAddress,
        authority: fromWallet.publicKey,
      },
      signers: [fromWallet.payer],
    });

    const fromAccountOnChain = await program.account.coinAccount.fetch(fromAddress);
    const toAccountOnChain = await program.account.coinAccount.fetch(toAddress);
    assert.equal(fromAccountOnChain.balance.toNumber(), 50);
    assert.equal(toAccountOnChain.balance.toNumber(), 50);
  });
});
