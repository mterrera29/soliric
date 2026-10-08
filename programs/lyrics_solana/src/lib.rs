use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("5LWoTgRR5HD4pkPq4qQ38BEeaVfd6Uuvs3Svkm6X3MTJ");

pub const MAX_CONTRIBUTORS: usize = 8;
pub const BPS_TOTAL: u16 = 10_000;
/// Ventana de objeción máxima: 7 días.
pub const MAX_OBJECTION_SECS: i64 = 7 * 24 * 60 * 60;

#[program]
pub mod lyrics_solana {
    use super::*;

    /// Crea una obra y registra la versión 0.
    /// `solo = true`: un único autor firma la obra como suya (100%). Con `objection_secs > 0`
    /// queda en ventana pública de impugnación (`Closing`); con 0 queda final al instante.
    /// `solo = false`: queda abierta para colaboradores y versiones.
    /// `units` es la cantidad de cambio de esta versión (la app la calcula con un diff).
    pub fn create_work(
        ctx: Context<CreateWork>,
        work_id: [u8; 32],
        content_hash: [u8; 32],
        units: u64,
        solo: bool,
        objection_secs: i64,
    ) -> Result<()> {
        require!(
            (0..=MAX_OBJECTION_SECS).contains(&objection_secs),
            LyricsError::InvalidWindow
        );
        let work_key = ctx.accounts.work.key();
        let creator = ctx.accounts.creator.key();
        init_work(
            &mut ctx.accounts.work,
            &mut ctx.accounts.version,
            work_key,
            creator,
            work_id,
            content_hash,
            units,
            solo,
            objection_secs,
            None,
            (ctx.bumps.work, ctx.bumps.version),
        )
    }

    /// El creador suma a un colaborador mientras la obra está abierta.
    pub fn add_collaborator(ctx: Context<CreatorOnly>, wallet: Pubkey) -> Result<()> {
        let work = &mut ctx.accounts.work;
        require!(work.status == Status::Open, LyricsError::NotOpen);
        require!(
            work.contributors.len() < MAX_CONTRIBUTORS,
            LyricsError::TooManyContributors
        );
        require!(
            !work.contributors.iter().any(|c| c.wallet == wallet),
            LyricsError::AlreadyContributor
        );
        work.contributors.push(Contributor {
            wallet,
            units: 0,
            bps: 0,
            signed: false,
            joined: false,
        });
        Ok(())
    }

    /// El invitado acepta participar (y acepta la regla de reparto por aportes).
    pub fn accept_invite(ctx: Context<SignSplit>) -> Result<()> {
        let signer = ctx.accounts.signer.key();
        let work = &mut ctx.accounts.work;
        require!(work.status == Status::Open, LyricsError::NotOpen);
        let c = work
            .contributors
            .iter_mut()
            .find(|c| c.wallet == signer)
            .ok_or(LyricsError::NotContributor)?;
        c.joined = true;
        Ok(())
    }

    /// El creador retira una invitación que todavía no fue aceptada.
    pub fn remove_invite(ctx: Context<CreatorOnly>, wallet: Pubkey) -> Result<()> {
        let work = &mut ctx.accounts.work;
        require!(work.status == Status::Open, LyricsError::NotOpen);
        let before = work.contributors.len();
        work.contributors.retain(|c| c.wallet != wallet || c.joined);
        require!(work.contributors.len() < before, LyricsError::NotContributor);
        Ok(())
    }

    /// Un colaborador registra una nueva versión (checkpoint) de la obra.
    pub fn commit_version(
        ctx: Context<CommitVersion>,
        content_hash: [u8; 32],
        units: u64,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let author = ctx.accounts.author.key();
        let work = &mut ctx.accounts.work;
        require!(work.status == Status::Open, LyricsError::NotOpen);

        let contributor = work
            .contributors
            .iter_mut()
            .find(|c| c.wallet == author)
            .ok_or(LyricsError::NotContributor)?;
        require!(contributor.joined, LyricsError::NotJoined);
        contributor.units = contributor.units.checked_add(units).unwrap();

        let version = &mut ctx.accounts.version;
        version.work = work.key();
        version.index = work.version_count;
        version.author = author;
        version.content_hash = content_hash;
        version.prev_hash = work.latest_hash;
        version.units = units;
        version.timestamp = now;
        version.bump = ctx.bumps.version;

        work.latest_hash = content_hash;
        work.version_count = work.version_count.checked_add(1).unwrap();
        emit!(VersionCommitted {
            work: work.key(),
            author,
            index: ctx.accounts.version.index,
            content_hash,
        });
        Ok(())
    }

    /// El creador cierra la edición.
    /// Sin `manual_bps`: reparto automático por aportes, queda final al instante.
    /// Con `manual_bps`: queda propuesto y todos deben firmarlo.
    pub fn propose_split(
        ctx: Context<CreatorOnly>,
        manual_bps: Option<Vec<u16>>,
        objection_secs: i64,
    ) -> Result<()> {
        let work = &mut ctx.accounts.work;
        require!(work.status == Status::Open, LyricsError::NotOpen);
        require!(
            work.contributors.iter().all(|c| c.joined),
            LyricsError::PendingInvites
        );
        let manual = manual_bps.is_some();
        require!(
            (0..=MAX_OBJECTION_SECS).contains(&objection_secs),
            LyricsError::InvalidWindow
        );

        match manual_bps {
            Some(bps) => {
                require!(
                    bps.len() == work.contributors.len(),
                    LyricsError::InvalidSplit
                );
                let total: u32 = bps.iter().map(|b| *b as u32).sum();
                require!(total == BPS_TOTAL as u32, LyricsError::InvalidSplit);
                for (c, b) in work.contributors.iter_mut().zip(bps) {
                    c.bps = b;
                }
            }
            None => {
                let total: u128 = work.contributors.iter().map(|c| c.units as u128).sum();
                require!(total > 0, LyricsError::NoContributions);
                let mut top = 0usize;
                for (i, c) in work.contributors.iter().enumerate() {
                    if c.units > work.contributors[top].units {
                        top = i;
                    }
                }
                let mut sum: u16 = 0;
                for c in work.contributors.iter_mut() {
                    c.bps = (c.units as u128 * BPS_TOTAL as u128 / total) as u16;
                    sum += c.bps;
                }
                // el resto por redondeo va al mayor contribuyente
                work.contributors[top].bps += BPS_TOTAL - sum;
            }
        }

        if manual {
            // reparto manual: todos tienen que firmarlo
            for c in work.contributors.iter_mut() {
                c.signed = false;
            }
            work.status = Status::Proposed;
        } else {
            // reparto automático por aportes: ya aceptado al unirse.
            // Con ventana > 0 cualquier autor puede objetar antes de que quede final.
            for c in work.contributors.iter_mut() {
                c.signed = true;
            }
            if objection_secs == 0 {
                work.status = Status::Final;
            } else {
                work.closes_at = Clock::get()?.unix_timestamp + objection_secs;
                work.status = Status::Closing;
            }
        }
        Ok(())
    }

    /// Cada autor firma el reparto propuesto. Cuando firman todos, la obra queda final.
    pub fn sign_split(ctx: Context<SignSplit>) -> Result<()> {
        let signer = ctx.accounts.signer.key();
        let work = &mut ctx.accounts.work;
        require!(work.status == Status::Proposed, LyricsError::NotProposed);

        let contributor = work
            .contributors
            .iter_mut()
            .find(|c| c.wallet == signer)
            .ok_or(LyricsError::NotContributor)?;
        contributor.signed = true;

        if work.contributors.iter().all(|c| c.signed) {
            work.status = Status::Final;
        }
        Ok(())
    }

    /// Define si la obra permite derivados (traducciones, covers, adaptaciones)
    /// y cuánto cuesta la licencia en lamports. Solo con la obra final.
    pub fn set_license(
        ctx: Context<CreatorOnly>,
        allow_derivatives: bool,
        derivative_fee: u64,
    ) -> Result<()> {
        let work = &mut ctx.accounts.work;
        require!(work.status == Status::Final, LyricsError::NotFinal);
        work.allow_derivatives = allow_derivatives;
        work.derivative_fee = derivative_fee;
        Ok(())
    }

    /// Crea una obra derivada pagando la licencia de la original.
    /// El pago se reparte según el reparto final de la original.
    /// `remaining_accounts`: las wallets de los autores de la original, en orden.
    pub fn create_derivative<'info>(
        ctx: Context<'info, CreateDerivative<'info>>,
        work_id: [u8; 32],
        content_hash: [u8; 32],
        units: u64,
        solo: bool,
    ) -> Result<()> {
        let parent = &mut ctx.accounts.parent;
        require!(parent.status == Status::Final, LyricsError::NotFinal);
        require!(parent.allow_derivatives, LyricsError::DerivativesNotAllowed);
        require!(
            ctx.remaining_accounts.len() == parent.contributors.len(),
            LyricsError::AuthorAccountsMismatch
        );

        let fee = parent.derivative_fee;
        let last = parent.contributors.len() - 1;
        let mut paid: u64 = 0;
        for (i, c) in parent.contributors.iter().enumerate() {
            let acc = &ctx.remaining_accounts[i];
            require_keys_eq!(acc.key(), c.wallet, LyricsError::AuthorAccountsMismatch);
            // el último recibe el resto para no perder lamports por redondeo
            let amount = if i == last {
                fee - paid
            } else {
                (fee as u128 * c.bps as u128 / BPS_TOTAL as u128) as u64
            };
            paid += amount;
            if amount > 0 {
                transfer(
                    CpiContext::new(
                        ctx.accounts.system_program.key(),
                        Transfer {
                            from: ctx.accounts.creator.to_account_info(),
                            to: acc.clone(),
                        },
                    ),
                    amount,
                )?;
            }
        }
        parent.derivative_count = parent.derivative_count.checked_add(1).unwrap();
        let parent_key = parent.key();

        let work_key = ctx.accounts.work.key();
        let creator = ctx.accounts.creator.key();
        init_work(
            &mut ctx.accounts.work,
            &mut ctx.accounts.version,
            work_key,
            creator,
            work_id,
            content_hash,
            units,
            solo,
            0,
            Some(parent_key),
            (ctx.bumps.work, ctx.bumps.version),
        )
    }

    /// Un autor objeta el reparto automático dentro de la ventana: vuelve a edición.
    pub fn object(ctx: Context<SignSplit>) -> Result<()> {
        let signer = ctx.accounts.signer.key();
        let work = &mut ctx.accounts.work;
        require!(work.status == Status::Closing, LyricsError::NotClosing);
        require!(
            Clock::get()?.unix_timestamp < work.closes_at,
            LyricsError::WindowClosed
        );
        require!(
            work.contributors.iter().any(|c| c.wallet == signer),
            LyricsError::NotContributor
        );
        for c in work.contributors.iter_mut() {
            c.signed = false;
            c.bps = 0;
        }
        work.closes_at = 0;
        work.status = Status::Open;
        Ok(())
    }

    /// Cualquiera puede dejar final un reparto automático cuando venció la ventana.
    pub fn finalize(ctx: Context<SignSplit>) -> Result<()> {
        let work = &mut ctx.accounts.work;
        require!(work.status == Status::Closing, LyricsError::NotClosing);
        require!(
            Clock::get()?.unix_timestamp >= work.closes_at,
            LyricsError::StillInWindow
        );
        work.status = Status::Final;
        emit!(Finalized { work: work.key() });
        Ok(())
    }

    /// El creador reabre la obra si alguien no está de acuerdo con el reparto.
    pub fn reopen(ctx: Context<CreatorOnly>) -> Result<()> {
        let work = &mut ctx.accounts.work;
        require!(work.status == Status::Proposed, LyricsError::NotProposed);
        for c in work.contributors.iter_mut() {
            c.signed = false;
            c.bps = 0;
        }
        work.status = Status::Open;
        Ok(())
    }

    /// Crea la configuración global con la wallet árbitro que resuelve impugnaciones.
    /// Hay que llamarla justo después del deploy.
    pub fn init_config(ctx: Context<InitConfig>, arbiter: Pubkey) -> Result<()> {
        ctx.accounts.config.arbiter = arbiter;
        ctx.accounts.config.bump = ctx.bumps.config;
        Ok(())
    }

    /// El árbitro actual puede traspasar el rol.
    pub fn set_arbiter(ctx: Context<SetArbiter>, arbiter: Pubkey) -> Result<()> {
        ctx.accounts.config.arbiter = arbiter;
        Ok(())
    }

    /// Cualquier wallet ajena a la obra la impugna (ej. "es de otro autor") mientras está
    /// en ventana o ya final. Queda en disputa hasta que el árbitro resuelva.
    pub fn challenge(ctx: Context<ChallengeWork>, evidence_hash: [u8; 32]) -> Result<()> {
        let challenger = ctx.accounts.challenger.key();
        let work = &mut ctx.accounts.work;
        require!(
            work.status == Status::Closing || work.status == Status::Final,
            LyricsError::NotChallengeable
        );
        require!(
            !work.contributors.iter().any(|c| c.wallet == challenger),
            LyricsError::ContributorCannotChallenge
        );
        let now = Clock::get()?.unix_timestamp;
        let ch = &mut ctx.accounts.challenge;
        ch.work = work.key();
        ch.challenger = challenger;
        ch.evidence_hash = evidence_hash;
        ch.prev_status = work.status;
        ch.resolved = false;
        ch.upheld = false;
        ch.created_at = now;
        ch.bump = ctx.bumps.challenge;
        work.status = Status::Disputed;
        emit!(Challenged { work: work.key(), challenger, evidence_hash });
        Ok(())
    }

    /// El árbitro resuelve: si la impugnación prospera la obra queda revocada (definitivo);
    /// si no, vuelve al estado que tenía.
    pub fn resolve_challenge(ctx: Context<ResolveChallenge>, upheld: bool) -> Result<()> {
        let work = &mut ctx.accounts.work;
        let ch = &mut ctx.accounts.challenge;
        require!(work.status == Status::Disputed, LyricsError::NotDisputed);
        require!(!ch.resolved, LyricsError::NotDisputed);
        ch.resolved = true;
        ch.upheld = upheld;
        work.status = if upheld { Status::Revoked } else { ch.prev_status };
        emit!(Resolved { work: work.key(), challenger: ch.challenger, upheld });
        Ok(())
    }
}

#[event]
pub struct WorkCreated {
    pub work: Pubkey,
    pub creator: Pubkey,
    pub work_id: [u8; 32],
    pub content_hash: [u8; 32],
    pub status: Status,
}

#[event]
pub struct VersionCommitted {
    pub work: Pubkey,
    pub author: Pubkey,
    pub index: u32,
    pub content_hash: [u8; 32],
}

#[event]
pub struct Finalized {
    pub work: Pubkey,
}

#[event]
pub struct Challenged {
    pub work: Pubkey,
    pub challenger: Pubkey,
    pub evidence_hash: [u8; 32],
}

#[event]
pub struct Resolved {
    pub work: Pubkey,
    pub challenger: Pubkey,
    pub upheld: bool,
}

#[allow(clippy::too_many_arguments)]
fn init_work(
    work: &mut Work,
    version: &mut Version,
    work_key: Pubkey,
    creator: Pubkey,
    work_id: [u8; 32],
    content_hash: [u8; 32],
    units: u64,
    solo: bool,
    objection_secs: i64,
    parent: Option<Pubkey>,
    bumps: (u8, u8),
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    work.creator = creator;
    work.work_id = work_id;
    work.latest_hash = content_hash;
    work.version_count = 1;
    work.created_at = now;
    work.bump = bumps.0;
    work.parent = parent;
    work.allow_derivatives = false;
    work.derivative_fee = 0;
    work.derivative_count = 0;
    work.closes_at = 0;
    work.contributors = vec![Contributor {
        wallet: creator,
        units,
        bps: if solo { BPS_TOTAL } else { 0 },
        signed: solo,
        joined: true,
    }];
    work.status = if !solo {
        Status::Open
    } else if objection_secs > 0 {
        work.closes_at = now + objection_secs;
        Status::Closing
    } else {
        Status::Final
    };

    version.work = work_key;
    version.index = 0;
    version.author = creator;
    version.content_hash = content_hash;
    version.prev_hash = [0u8; 32];
    version.units = units;
    version.timestamp = now;
    version.bump = bumps.1;
    emit!(WorkCreated {
        work: work_key,
        creator,
        work_id,
        content_hash,
        status: work.status,
    });
    Ok(())
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum Status {
    /// Se pueden sumar colaboradores y versiones.
    Open,
    /// Hay un reparto manual propuesto, esperando firmas.
    Proposed,
    /// Reparto automático en ventana de objeción: si nadie objeta, queda final.
    Closing,
    /// Todos firmaron; el reparto es definitivo.
    Final,
    /// Un tercero impugnó la obra; espera la resolución del árbitro.
    Disputed,
    /// La impugnación prosperó: la obra quedó revocada (no se puede licenciar ni derivar).
    Revoked,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct Contributor {
    pub wallet: Pubkey,
    /// Unidades de cambio acumuladas (base del reparto automático).
    pub units: u64,
    /// Porcentaje en basis points (10000 = 100%). Vale desde que se propone el reparto.
    pub bps: u16,
    pub signed: bool,
    /// El colaborador aceptó la invitación (el creador entra ya aceptado).
    pub joined: bool,
}

#[account]
#[derive(InitSpace)]
pub struct Work {
    pub creator: Pubkey,
    pub work_id: [u8; 32],
    pub status: Status,
    /// Hash de la última versión; el texto vive off-chain.
    pub latest_hash: [u8; 32],
    pub version_count: u32,
    #[max_len(MAX_CONTRIBUTORS)]
    pub contributors: Vec<Contributor>,
    pub created_at: i64,
    pub bump: u8,
    /// Obra original si esta es un derivado (traducción, cover, adaptación).
    pub parent: Option<Pubkey>,
    pub allow_derivatives: bool,
    /// Precio en lamports de la licencia para crear un derivado.
    pub derivative_fee: u64,
    pub derivative_count: u32,
    /// Fin de la ventana de objeción (unix). Solo vale en estado Closing.
    pub closes_at: i64,
}

#[account]
#[derive(InitSpace)]
pub struct Version {
    pub work: Pubkey,
    pub index: u32,
    pub author: Pubkey,
    pub content_hash: [u8; 32],
    pub prev_hash: [u8; 32],
    pub units: u64,
    pub timestamp: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub arbiter: Pubkey,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Challenge {
    pub work: Pubkey,
    pub challenger: Pubkey,
    /// Hash de la evidencia (texto/links) guardada off-chain.
    pub evidence_hash: [u8; 32],
    /// Estado de la obra antes de la disputa, para restaurarlo si no prospera.
    pub prev_status: Status,
    pub resolved: bool,
    pub upheld: bool,
    pub created_at: i64,
    pub bump: u8,
}

#[derive(Accounts)]
pub struct InitConfig<'info> {
    #[account(init, payer = payer, space = 8 + Config::INIT_SPACE, seeds = [b"config"], bump)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SetArbiter<'info> {
    #[account(mut, seeds = [b"config"], bump = config.bump, has_one = arbiter @ LyricsError::NotArbiter)]
    pub config: Account<'info, Config>,
    pub arbiter: Signer<'info>,
}

#[derive(Accounts)]
pub struct ChallengeWork<'info> {
    #[account(mut)]
    pub work: Account<'info, Work>,
    #[account(
        init,
        payer = challenger,
        space = 8 + Challenge::INIT_SPACE,
        seeds = [b"challenge", work.key().as_ref(), challenger.key().as_ref()],
        bump
    )]
    pub challenge: Account<'info, Challenge>,
    #[account(mut)]
    pub challenger: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveChallenge<'info> {
    #[account(seeds = [b"config"], bump = config.bump, has_one = arbiter @ LyricsError::NotArbiter)]
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub work: Account<'info, Work>,
    #[account(mut, has_one = work)]
    pub challenge: Account<'info, Challenge>,
    pub arbiter: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(work_id: [u8; 32])]
pub struct CreateWork<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + Work::INIT_SPACE,
        seeds = [b"work", work_id.as_ref()],
        bump
    )]
    pub work: Account<'info, Work>,
    #[account(
        init,
        payer = creator,
        space = 8 + Version::INIT_SPACE,
        seeds = [b"version", work.key().as_ref(), &0u32.to_le_bytes()],
        bump
    )]
    pub version: Account<'info, Version>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(work_id: [u8; 32])]
pub struct CreateDerivative<'info> {
    #[account(mut)]
    pub parent: Account<'info, Work>,
    #[account(
        init,
        payer = creator,
        space = 8 + Work::INIT_SPACE,
        seeds = [b"work", work_id.as_ref()],
        bump
    )]
    pub work: Account<'info, Work>,
    #[account(
        init,
        payer = creator,
        space = 8 + Version::INIT_SPACE,
        seeds = [b"version", work.key().as_ref(), &0u32.to_le_bytes()],
        bump
    )]
    pub version: Account<'info, Version>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreatorOnly<'info> {
    #[account(mut, has_one = creator @ LyricsError::NotCreator)]
    pub work: Account<'info, Work>,
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct CommitVersion<'info> {
    #[account(mut)]
    pub work: Account<'info, Work>,
    #[account(
        init,
        payer = author,
        space = 8 + Version::INIT_SPACE,
        seeds = [b"version", work.key().as_ref(), &work.version_count.to_le_bytes()],
        bump
    )]
    pub version: Account<'info, Version>,
    #[account(mut)]
    pub author: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SignSplit<'info> {
    #[account(mut)]
    pub work: Account<'info, Work>,
    pub signer: Signer<'info>,
}

#[error_code]
pub enum LyricsError {
    #[msg("Solo el creador puede hacer esto")]
    NotCreator,
    #[msg("La obra no está abierta a cambios")]
    NotOpen,
    #[msg("No hay un reparto propuesto")]
    NotProposed,
    #[msg("Esa wallet no es colaboradora de la obra")]
    NotContributor,
    #[msg("Máximo 8 colaboradores")]
    TooManyContributors,
    #[msg("Esa wallet ya es colaboradora")]
    AlreadyContributor,
    #[msg("El reparto debe tener un valor por colaborador y sumar 100%")]
    InvalidSplit,
    #[msg("Todavía no hay cambios registrados para calcular el reparto")]
    NoContributions,
    #[msg("Ese colaborador todavía no aceptó la invitación")]
    NotJoined,
    #[msg("La ventana de objeción debe estar entre 0 y 7 días")]
    InvalidWindow,
    #[msg("El reparto no está en ventana de objeción")]
    NotClosing,
    #[msg("La ventana de objeción ya cerró")]
    WindowClosed,
    #[msg("La ventana de objeción sigue abierta")]
    StillInWindow,
    #[msg("Hay invitaciones sin aceptar")]
    PendingInvites,
    #[msg("La obra debe estar final (reparto firmado por todos)")]
    NotFinal,
    #[msg("Esta obra no permite derivados")]
    DerivativesNotAllowed,
    #[msg("Las cuentas de autores no coinciden con las de la obra original")]
    AuthorAccountsMismatch,
    #[msg("Solo se puede impugnar una obra en ventana o final")]
    NotChallengeable,
    #[msg("Los autores de la obra no pueden impugnarla; deben objetar")]
    ContributorCannotChallenge,
    #[msg("La obra no está en disputa")]
    NotDisputed,
    #[msg("Solo el árbitro puede hacer esto")]
    NotArbiter,
}
