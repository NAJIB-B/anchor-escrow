use anchor_lang::prelude::*;
mod state;
mod instructions;

pub use state::*;
pub use instructions::*;

declare_id!("HLze5gPcuXFLGov2y6Jbrbkm4zKVQ8gEAugv8JcBXDUz");

#[allow(unexpected_cfgs)]
#[program]
pub mod anchor_escrow {
    use super::*;

    pub fn make(ctx: Context<Make>, seed: u64, receive: u64, deposit: u64) -> Result<()> {

        ctx.accounts.make(seed, receive, &ctx.bumps)?;

        ctx.accounts.deposit(deposit)?;

        Ok(())
    }

    pub fn take(ctx: Context<Take>) -> Result<()> {

        ctx.accounts.deposit()?;
        ctx.accounts.withdraw_and_close()?;
        Ok(())
    }

    pub fn refund(ctx: Context<Refund>) -> Result<()> {

        ctx.accounts.refund_and_close()?;
        Ok(())
    }
}

