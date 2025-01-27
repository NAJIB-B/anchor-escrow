import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnchorEscrow } from "../target/types/anchor_escrow";
import {
  createMint,
  mintTo,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmRawTransaction,
} from "@solana/web3.js";
import { BN } from "bn.js";
import { randomBytes } from "crypto";
import { assert, expect } from "chai";

describe("anchor-escrow", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AnchorEscrow as Program<AnchorEscrow>;
  const token_program = TOKEN_2022_PROGRAM_ID;

  const [maker, taker] = Array.from({ length: 2 }, () => Keypair.generate());

  console.log("created maker", maker.publicKey);
  console.log("created taker", taker.publicKey);

  const airdropSol = async (address: PublicKey) => {
    const tx = await provider.connection.requestAirdrop(
      address,
      2 * LAMPORTS_PER_SOL
    );

    await provider.connection.confirmTransaction(tx, "confirmed");
    console.log(
      `airdropped sol to ${address} https://explorer.solana.com/tx/${tx}?cluster=devnet`
    );
  };

  let mint_a, mint_b, maker_ata_a, maker_ata_b, taker_ata_a, taker_ata_b;

  const initialize_accounts = async () => {
    await airdropSol(maker.publicKey);
    await airdropSol(taker.publicKey);

    mint_a = await createMint(
      provider.connection,
      maker,
      maker.publicKey,
      null,
      6
    );
    mint_b = await createMint(
      provider.connection,
      taker,
      taker.publicKey,
      null,
      6
    );

    maker_ata_a = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      maker,
      mint_a,
      maker.publicKey
    );
    maker_ata_b = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      maker,
      mint_b,
      maker.publicKey
    );

    taker_ata_a = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      taker,
      mint_a,
      taker.publicKey
    );
    taker_ata_b = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      taker,
      mint_b,
      taker.publicKey
    );


    const token_decimals = 1000000;

    const mintATx = await mintTo(
      provider.connection,
      maker,
      mint_a,
      maker_ata_a.address,
      maker,
      token_decimals * 100
    );
    const mintBTx = await mintTo(
      provider.connection,
      taker,
      mint_b,
      taker_ata_b.address,
      taker,
      token_decimals * 100
    );

    console.log(
      `minted token a https://explorer.solana.com/tx/${mintATx}?cluster=devnet`
    );
    console.log(
      `minted token b https://explorer.solana.com/tx/${mintBTx}?cluster=devnet`
    );
  };
  const seed = new BN(randomBytes(8));

  it("Is initialized!", async () => {
    await initialize_accounts();


    const escrow = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        maker.publicKey.toBuffer(),
        seed.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    )[0];
    const vault = getAssociatedTokenAddressSync(mint_a, escrow, true, TOKEN_PROGRAM_ID);

    try {
      await program.methods
        .make(seed, new BN(1e6), new BN(1e6))
        .accountsPartial({
          maker: maker.publicKey,
          mintA: mint_a,
          mintB: mint_b,
          makerAtaA: maker_ata_a.address,
          vault,
          escrow,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID
        }).signers([maker])
        .rpc();

      const account = await program.account.escrow.fetch(escrow);

      assert.equal(account.mintA.toBase58(), mint_a.toBase58());
      assert.equal(account.maker.toBase58(), maker.publicKey.toBase58());
    } catch (error) {
      console.log(error);
    }
  });

  it("taking", async () => {


    const escrow = PublicKey.findProgramAddressSync(
      [
        Buffer.from("escrow"),
        maker.publicKey.toBuffer(),
        seed.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    )[0];
    const vault = getAssociatedTokenAddressSync(mint_a, escrow, true, TOKEN_PROGRAM_ID);

    try {
      await program.methods
        .take()
        .accountsStrict({
          maker: maker.publicKey,
          taker: taker.publicKey,
          mintA: mint_a,
          mintB: mint_b,
          takerAtaA: taker_ata_a.address,
          takerAtaB: taker_ata_b.address,
          makerAtaB: maker_ata_b.address,
          vault,
          escrow,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId
        }).signers([taker])
        .rpc();




    } catch (error) {
      console.log(error);
    }
  });
});
