use anchor_lang::prelude::*;

declare_id!("HuMoYQSKU9Cpoh73evPnwSJ2oHAQn29YR1rpif6UfVwk");

#[program]
pub mod test_coin {
    use super::*;

    pub fn new(ctx: Context<Constructor>) -> ProgramResult {
        let Constructor {
            settings,
            authority,
            ..
        } = ctx.accounts;
        settings.authority = authority.key();
        settings.total_supply = 0;

        Ok({})
    }

    pub fn initialize_account(ctx: Context<InitializeAccount>) -> ProgramResult {
        let InitializeAccount {
            coin_account: account,
            authority,
            ..
        } = ctx.accounts;

        account.balance = 0;
        account.authority = *authority.key;

        Ok({})
    }

    pub fn mint(ctx: Context<Mint>, amount: u64) -> ProgramResult {
        let Mint {
            coin_settings,
            target_account,
            ..
        } = ctx.accounts;

        target_account.balance += amount;
        coin_settings.total_supply += amount;

        Ok({})
    }

    pub fn transfer(ctx: Context<Transfer>, amount: u64) -> Result<()> {
        let Transfer {
            from_account,
            target_account,
            ..
        } = ctx.accounts;

        if from_account.balance < amount {
            return Err(ErrorCode::NotEnoughBalance.into());
        }

        from_account.balance -= amount;
        target_account.balance += amount;

        Ok({})
    }
}

#[account]
pub struct CoinSettings {
    pub authority: Pubkey,
    pub total_supply: u64,
}

#[account]
pub struct CoinAccount {
    pub authority: Pubkey,
    pub balance: u64,
}

#[derive(Accounts)]
pub struct Constructor<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8,
        seeds = [b"settings"],
        bump
    )]
    pub settings: Account<'info, CoinSettings>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeAccount<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 8,
        seeds = [authority.key().as_ref()],
        bump
    )]
    pub coin_account: Account<'info, CoinAccount>,
    #[account(signer, mut)]
    pub authority: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Mint<'info> {
    #[account(mut, has_one = authority)]
    pub coin_settings: Account<'info, CoinSettings>,
    pub authority: Signer<'info>,
    #[account(mut)]
    pub target_account: Account<'info, CoinAccount>,
}

#[derive(Accounts)]
pub struct Transfer<'info> {
    #[account(mut, has_one = authority)]
    pub from_account: Account<'info, CoinAccount>,
    #[account(mut)]
    pub target_account: Account<'info, CoinAccount>,
    pub authority: Signer<'info>,
}

#[error]
pub enum ErrorCode {
    #[msg("You have no enough coins to perform this action.")]
    NotEnoughBalance,
}
