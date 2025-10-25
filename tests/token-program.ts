import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAccount, getAssociatedTokenAddress } from "@solana/spl-token";
import { expect } from "chai";
const { BN, Program } = anchor;

describe("spl program test", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.local();
  anchor.setProvider(provider);
  const wallet = provider.wallet as anchor.Wallet;
  const program = anchor.workspace.Spl as Program; // 👈 matches your #[program] name: `mod spl`

  let mintPda: PublicKey;
  let metadataPda: PublicKey;
  let bump: number;

  const metadata = {
    name: "MyToken",
    symbol: "MTK",
    uri: "https://example.com/metadata.json",
    decimals: 9,
  };

  it("Initialize token mint with metadata", async () => {
    // Derive PDA for mint
    [mintPda, bump] = await PublicKey.findProgramAddressSync(
      [Buffer.from("mint")],
      program.programId
    );

    // Derive PDA for metadata (Metaplex metadata account)
    const tokenMetadataProgramId = new PublicKey(
      "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s" // metaplex metadata program id
    );
    [metadataPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        tokenMetadataProgramId.toBuffer(),
        mintPda.toBuffer(),
      ],
      tokenMetadataProgramId
    );

    await program.methods
      .initiateToken(metadata)
      .accounts({
        metadata: metadataPda,
        mint: mintPda,
        payer: wallet.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        tokenMetadataProgram: tokenMetadataProgramId,
      })
      .signers([])
      .rpc();

    console.log("✅ Token initialized with mint:", mintPda.toBase58());
  });

  it("Mints tokens to user ATA", async () => {
    const ata = await getAssociatedTokenAddress(mintPda, wallet.publicKey);

    await program.methods
      .mintTokens(new BN(1000)

      ) // mint 100 tokens (if 9 decimals)
      .accounts({
        mint: mintPda,
        destination: ata,
        payer: wallet.publicKey,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID,
      })
      .signers([])
      .rpc();

    const accountInfo = await getAccount(provider.connection, ata);
    expect(Number(accountInfo.amount)).to.equal(100_000_000_000);
    console.log("✅ Minted tokens to:", ata.toBase58());
  });
});
