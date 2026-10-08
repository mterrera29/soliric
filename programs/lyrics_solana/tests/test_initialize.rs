use {
    anchor_lang::{
        prelude::Pubkey,
        solana_program::{instruction::Instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    lyrics_solana::{Status, Version, Work},
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const SOL: u64 = 1_000_000_000;
const ID: [u8; 32] = [7u8; 32];

fn work_pda() -> Pubkey {
    Pubkey::find_program_address(&[b"work", ID.as_ref()], &lyrics_solana::id()).0
}
fn version_pda(index: u32) -> Pubkey {
    Pubkey::find_program_address(
        &[b"version", work_pda().as_ref(), &index.to_le_bytes()],
        &lyrics_solana::id(),
    )
    .0
}

fn send(svm: &mut LiteSVM, payer: &Keypair, ix: Instruction) -> Result<(), String> {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(&[ix], Some(&payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[payer]).unwrap();
    let res = svm
        .send_transaction(tx)
        .map(|_| ())
        .map_err(|e| format!("{:?}", e));
    svm.expire_blockhash(); // evita AlreadyProcessed en transacciones idénticas
    res
}

fn setup(users: &[&Keypair]) -> LiteSVM {
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!(concat!(
        env!("CARGO_TARGET_TMPDIR"),
        "/../test-deploy/lyrics_solana.so"
    ));
    svm.add_program(lyrics_solana::id(), bytes).unwrap();
    for u in users {
        svm.airdrop(&u.pubkey(), 5 * SOL).unwrap();
    }
    svm
}

fn ix<A: InstructionData>(data: A, metas: Vec<anchor_lang::solana_program::instruction::AccountMeta>) -> Instruction {
    Instruction::new_with_bytes(lyrics_solana::id(), &data.data(), metas)
}

fn create(creator: &Keypair, hash: [u8; 32], units: u64, solo: bool) -> Instruction {
    ix(
        lyrics_solana::instruction::CreateWork { work_id: ID, content_hash: hash, units, solo, objection_secs: 0 },
        lyrics_solana::accounts::CreateWork {
            work: work_pda(),
            version: version_pda(0),
            creator: creator.pubkey(),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn add(creator: &Keypair, who: &Keypair) -> Instruction {
    ix(
        lyrics_solana::instruction::AddCollaborator { wallet: who.pubkey() },
        lyrics_solana::accounts::CreatorOnly { work: work_pda(), creator: creator.pubkey() }
            .to_account_metas(None),
    )
}

fn commit(author: &Keypair, next_index: u32, hash: [u8; 32], units: u64) -> Instruction {
    ix(
        lyrics_solana::instruction::CommitVersion { content_hash: hash, units },
        lyrics_solana::accounts::CommitVersion {
            work: work_pda(),
            version: version_pda(next_index),
            author: author.pubkey(),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn propose(creator: &Keypair, manual: Option<Vec<u16>>) -> Instruction {
    ix(
        lyrics_solana::instruction::ProposeSplit { manual_bps: manual, objection_secs: 0 },
        lyrics_solana::accounts::CreatorOnly { work: work_pda(), creator: creator.pubkey() }
            .to_account_metas(None),
    )
}

fn accept(who: &Keypair) -> Instruction {
    ix(
        lyrics_solana::instruction::AcceptInvite {},
        lyrics_solana::accounts::SignSplit { work: work_pda(), signer: who.pubkey() }
            .to_account_metas(None),
    )
}

fn remove(creator: &Keypair, who: &Keypair) -> Instruction {
    ix(
        lyrics_solana::instruction::RemoveInvite { wallet: who.pubkey() },
        lyrics_solana::accounts::CreatorOnly { work: work_pda(), creator: creator.pubkey() }
            .to_account_metas(None),
    )
}

fn sign(who: &Keypair) -> Instruction {
    ix(
        lyrics_solana::instruction::SignSplit {},
        lyrics_solana::accounts::SignSplit { work: work_pda(), signer: who.pubkey() }
            .to_account_metas(None),
    )
}

fn work_of(svm: &LiteSVM) -> Work {
    let acc = svm.get_account(&work_pda()).unwrap();
    let mut data: &[u8] = &acc.data;
    Work::try_deserialize(&mut data).unwrap()
}

#[test]
fn solo_signs_work_as_own() {
    let ana = Keypair::new();
    let mut svm = setup(&[&ana]);
    send(&mut svm, &ana, create(&ana, [1u8; 32], 100, true)).unwrap();
    let w = work_of(&svm);
    assert!(w.status == Status::Final);
    assert_eq!(w.contributors[0].bps, 10_000);
    assert!(w.contributors[0].signed);
}

#[test]
fn studio_flow_auto_split_is_final_without_extra_signatures() {
    let ana = Keypair::new();
    let beto = Keypair::new();
    let mut svm = setup(&[&ana, &beto]);

    send(&mut svm, &ana, create(&ana, [1u8; 32], 200, false)).unwrap();
    send(&mut svm, &ana, add(&ana, &beto)).unwrap();
    send(&mut svm, &beto, accept(&beto)).unwrap();
    send(&mut svm, &beto, commit(&beto, 1, [2u8; 32], 100)).unwrap();
    send(&mut svm, &ana, commit(&ana, 2, [3u8; 32], 100)).unwrap();

    let w = work_of(&svm);
    assert_eq!(w.version_count, 3);
    assert_eq!(w.latest_hash, [3u8; 32]);

    // la cadena de versiones queda enlazada
    let acc = svm.get_account(&version_pda(2)).unwrap();
    let mut data: &[u8] = &acc.data;
    let v2 = Version::try_deserialize(&mut data).unwrap();
    assert_eq!(v2.prev_hash, [2u8; 32]);
    assert_eq!(v2.author, ana.pubkey());

    // Ana 300 unidades, Beto 100 -> 75% / 25%
    // reparto automático: queda final sin firmas extra
    send(&mut svm, &ana, propose(&ana, None)).unwrap();
    let w = work_of(&svm);
    assert!(w.status == Status::Final);
    assert_eq!(w.contributors[0].bps, 7_500);
    assert_eq!(w.contributors[1].bps, 2_500);
}

#[test]
fn manual_split_needs_every_signature() {
    let ana = Keypair::new();
    let beto = Keypair::new();
    let mut svm = setup(&[&ana, &beto]);
    send(&mut svm, &ana, create(&ana, [1u8; 32], 10, false)).unwrap();
    send(&mut svm, &ana, add(&ana, &beto)).unwrap();
    send(&mut svm, &beto, accept(&beto)).unwrap();
    send(&mut svm, &ana, propose(&ana, Some(vec![7_000, 3_000]))).unwrap();
    assert!(work_of(&svm).status == Status::Proposed);
    send(&mut svm, &ana, sign(&ana)).unwrap();
    assert!(work_of(&svm).status == Status::Proposed); // falta Beto
    send(&mut svm, &beto, sign(&beto)).unwrap();
    let w = work_of(&svm);
    assert!(w.status == Status::Final);
    assert_eq!(w.contributors[0].bps, 7_000);
}

#[test]
fn invitee_cannot_edit_until_accepting_and_pending_blocks_closing() {
    let ana = Keypair::new();
    let beto = Keypair::new();
    let mut svm = setup(&[&ana, &beto]);
    send(&mut svm, &ana, create(&ana, [1u8; 32], 10, false)).unwrap();
    send(&mut svm, &ana, add(&ana, &beto)).unwrap();
    assert!(send(&mut svm, &beto, commit(&beto, 1, [2u8; 32], 5)).is_err());
    assert!(send(&mut svm, &ana, propose(&ana, None)).is_err()); // Beto no aceptó

    // el creador puede retirar la invitación pendiente y cerrar
    send(&mut svm, &ana, remove(&ana, &beto)).unwrap();
    assert_eq!(work_of(&svm).contributors.len(), 1);
    send(&mut svm, &ana, propose(&ana, None)).unwrap();
    assert!(work_of(&svm).status == Status::Final);
}

#[test]
fn outsider_cannot_commit() {
    let ana = Keypair::new();
    let intruder = Keypair::new();
    let mut svm = setup(&[&ana, &intruder]);
    send(&mut svm, &ana, create(&ana, [1u8; 32], 10, false)).unwrap();
    assert!(send(&mut svm, &intruder, commit(&intruder, 1, [9u8; 32], 50)).is_err());
}

#[test]
fn no_commits_after_split_is_closed() {
    let ana = Keypair::new();
    let mut svm = setup(&[&ana]);
    send(&mut svm, &ana, create(&ana, [1u8; 32], 10, false)).unwrap();
    send(&mut svm, &ana, propose(&ana, None)).unwrap();
    assert!(send(&mut svm, &ana, commit(&ana, 1, [2u8; 32], 5)).is_err());
}

#[test]
fn manual_split_must_sum_to_100() {
    let ana = Keypair::new();
    let beto = Keypair::new();
    let mut svm = setup(&[&ana, &beto]);
    send(&mut svm, &ana, create(&ana, [1u8; 32], 10, false)).unwrap();
    send(&mut svm, &ana, add(&ana, &beto)).unwrap();
    send(&mut svm, &beto, accept(&beto)).unwrap();
    assert!(send(&mut svm, &ana, propose(&ana, Some(vec![5_000, 4_000]))).is_err());
    send(&mut svm, &ana, propose(&ana, Some(vec![5_000, 5_000]))).unwrap();
    assert_eq!(work_of(&svm).contributors[1].bps, 5_000);
}

#[test]
fn only_creator_can_add_or_propose() {
    let ana = Keypair::new();
    let beto = Keypair::new();
    let mut svm = setup(&[&ana, &beto]);
    send(&mut svm, &ana, create(&ana, [1u8; 32], 10, false)).unwrap();
    assert!(send(&mut svm, &beto, add(&beto, &beto)).is_err());
    assert!(send(&mut svm, &beto, propose(&beto, None)).is_err());
}

// ---- derivados (traducciones, covers, adaptaciones) ----

const CHILD: [u8; 32] = [8u8; 32];

fn pda_of(id: &[u8; 32]) -> Pubkey {
    Pubkey::find_program_address(&[b"work", id.as_ref()], &lyrics_solana::id()).0
}

fn license(creator: &Keypair, allow: bool, fee: u64) -> Instruction {
    ix(
        lyrics_solana::instruction::SetLicense { allow_derivatives: allow, derivative_fee: fee },
        lyrics_solana::accounts::CreatorOnly { work: work_pda(), creator: creator.pubkey() }
            .to_account_metas(None),
    )
}

fn derivative(creator: &Keypair, parent_authors: &[Pubkey]) -> Instruction {
    use anchor_lang::solana_program::instruction::AccountMeta;
    let child = pda_of(&CHILD);
    let child_v0 = Pubkey::find_program_address(
        &[b"version", child.as_ref(), &0u32.to_le_bytes()],
        &lyrics_solana::id(),
    )
    .0;
    let mut metas = lyrics_solana::accounts::CreateDerivative {
        parent: work_pda(),
        work: child,
        version: child_v0,
        creator: creator.pubkey(),
        system_program: system_program::ID,
    }
    .to_account_metas(None);
    for a in parent_authors {
        metas.push(AccountMeta::new(*a, false));
    }
    ix(
        lyrics_solana::instruction::CreateDerivative {
            work_id: CHILD,
            content_hash: [9u8; 32],
            units: 50,
            solo: true,
        },
        metas,
    )
}

/// Obra final de Ana (75%) y Beto (25%).
fn final_work(svm: &mut LiteSVM, ana: &Keypair, beto: &Keypair) {
    send(svm, ana, create(ana, [1u8; 32], 300, false)).unwrap();
    send(svm, ana, add(ana, beto)).unwrap();
    send(svm, beto, accept(beto)).unwrap();
    send(svm, beto, commit(beto, 1, [2u8; 32], 100)).unwrap();
    send(svm, ana, propose(ana, None)).unwrap();
}

#[test]
fn translation_pays_authors_by_final_split() {
    let (ana, beto, caro) = (Keypair::new(), Keypair::new(), Keypair::new());
    let mut svm = setup(&[&ana, &beto, &caro]);
    final_work(&mut svm, &ana, &beto);
    send(&mut svm, &ana, license(&ana, true, SOL)).unwrap();

    let (a0, b0) = (svm.get_balance(&ana.pubkey()).unwrap(), svm.get_balance(&beto.pubkey()).unwrap());
    send(&mut svm, &caro, derivative(&caro, &[ana.pubkey(), beto.pubkey()])).unwrap();

    assert_eq!(svm.get_balance(&ana.pubkey()).unwrap() - a0, 750_000_000);
    assert_eq!(svm.get_balance(&beto.pubkey()).unwrap() - b0, 250_000_000);

    let child = svm.get_account(&pda_of(&CHILD)).unwrap();
    let mut data: &[u8] = &child.data;
    let child = Work::try_deserialize(&mut data).unwrap();
    assert_eq!(child.parent, Some(work_pda()));
    assert!(child.status == Status::Final); // Caro firmó su derivado como suyo
    assert_eq!(work_of(&svm).derivative_count, 1);
}

#[test]
fn derivative_blocked_without_license_or_before_final() {
    let (ana, beto, caro) = (Keypair::new(), Keypair::new(), Keypair::new());
    let mut svm = setup(&[&ana, &beto, &caro]);
    // obra todavía abierta: no se puede licenciar ni derivar
    send(&mut svm, &ana, create(&ana, [1u8; 32], 300, false)).unwrap();
    assert!(send(&mut svm, &ana, license(&ana, true, SOL)).is_err());
    assert!(send(&mut svm, &caro, derivative(&caro, &[ana.pubkey()])).is_err());

    // obra final pero sin licencia habilitada
    send(&mut svm, &ana, propose(&ana, None)).unwrap();
    assert!(work_of(&svm).status == Status::Final);
    assert!(send(&mut svm, &caro, derivative(&caro, &[ana.pubkey()])).is_err());
}

#[test]
fn derivative_rejects_wrong_author_accounts() {
    let (ana, beto, caro) = (Keypair::new(), Keypair::new(), Keypair::new());
    let mut svm = setup(&[&ana, &beto, &caro]);
    final_work(&mut svm, &ana, &beto);
    send(&mut svm, &ana, license(&ana, true, SOL)).unwrap();
    // cuentas en orden incorrecto: el pago no puede desviarse
    assert!(send(&mut svm, &caro, derivative(&caro, &[beto.pubkey(), ana.pubkey()])).is_err());
}


// ---- ventana de objeción ----

fn propose_window(creator: &Keypair, secs: i64) -> Instruction {
    ix(
        lyrics_solana::instruction::ProposeSplit { manual_bps: None, objection_secs: secs },
        lyrics_solana::accounts::CreatorOnly { work: work_pda(), creator: creator.pubkey() }
            .to_account_metas(None),
    )
}
fn object_ix(who: &Keypair) -> Instruction {
    ix(
        lyrics_solana::instruction::Object {},
        lyrics_solana::accounts::SignSplit { work: work_pda(), signer: who.pubkey() }
            .to_account_metas(None),
    )
}
fn finalize_ix(who: &Keypair) -> Instruction {
    ix(
        lyrics_solana::instruction::Finalize {},
        lyrics_solana::accounts::SignSplit { work: work_pda(), signer: who.pubkey() }
            .to_account_metas(None),
    )
}
fn warp(svm: &mut LiteSVM, secs: i64) {
    let mut clock = svm.get_sysvar::<anchor_lang::prelude::Clock>();
    clock.unix_timestamp += secs;
    svm.set_sysvar(&clock);
}

#[test]
fn auto_split_waits_for_window_then_finalizes() {
    let (ana, beto, anyone) = (Keypair::new(), Keypair::new(), Keypair::new());
    let mut svm = setup(&[&ana, &beto, &anyone]);
    send(&mut svm, &ana, create(&ana, [1u8; 32], 300, false)).unwrap();
    send(&mut svm, &ana, add(&ana, &beto)).unwrap();
    send(&mut svm, &beto, accept(&beto)).unwrap();
    send(&mut svm, &beto, commit(&beto, 1, [2u8; 32], 100)).unwrap();

    send(&mut svm, &ana, propose_window(&ana, 3_600)).unwrap();
    assert!(work_of(&svm).status == Status::Closing);
    // no se puede finalizar antes de que venza la ventana
    assert!(send(&mut svm, &anyone, finalize_ix(&anyone)).is_err());

    warp(&mut svm, 3_601);
    // cualquiera puede finalizar; el no autor también (es solo ejecutar el plazo)
    send(&mut svm, &anyone, finalize_ix(&anyone)).unwrap();
    assert!(work_of(&svm).status == Status::Final);
    assert_eq!(work_of(&svm).contributors[0].bps, 7_500);
}

#[test]
fn author_can_object_inside_window_only() {
    let (ana, beto) = (Keypair::new(), Keypair::new());
    let mut svm = setup(&[&ana, &beto]);
    send(&mut svm, &ana, create(&ana, [1u8; 32], 300, false)).unwrap();
    send(&mut svm, &ana, add(&ana, &beto)).unwrap();
    send(&mut svm, &beto, accept(&beto)).unwrap();
    send(&mut svm, &beto, commit(&beto, 1, [2u8; 32], 100)).unwrap();
    send(&mut svm, &ana, propose_window(&ana, 3_600)).unwrap();

    // Beto objeta: vuelve a edición y se limpian los porcentajes
    send(&mut svm, &beto, object_ix(&beto)).unwrap();
    let w = work_of(&svm);
    assert!(w.status == Status::Open);
    assert_eq!(w.contributors[1].bps, 0);

    // segunda ronda: tras vencer, ya no se puede objetar
    send(&mut svm, &ana, propose_window(&ana, 60)).unwrap();
    warp(&mut svm, 61);
    assert!(send(&mut svm, &beto, object_ix(&beto)).is_err());
}

#[test]
fn outsider_cannot_object_and_window_is_capped() {
    let (ana, beto) = (Keypair::new(), Keypair::new());
    let mut svm = setup(&[&ana, &beto]);
    send(&mut svm, &ana, create(&ana, [1u8; 32], 300, false)).unwrap();
    assert!(send(&mut svm, &ana, propose_window(&ana, 8 * 24 * 3_600)).is_err());
    send(&mut svm, &ana, propose_window(&ana, 3_600)).unwrap();
    assert!(send(&mut svm, &beto, object_ix(&beto)).is_err());
}


// ---- procedencia: ventana en obras solo + impugnaciones ----

fn create_solo_window(creator: &Keypair, secs: i64) -> Instruction {
    ix(
        lyrics_solana::instruction::CreateWork {
            work_id: ID,
            content_hash: [1u8; 32],
            units: 100,
            solo: true,
            objection_secs: secs,
        },
        lyrics_solana::accounts::CreateWork {
            work: work_pda(),
            version: version_pda(0),
            creator: creator.pubkey(),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn config_pda() -> Pubkey {
    Pubkey::find_program_address(&[b"config"], &lyrics_solana::id()).0
}
fn challenge_pda(who: &Keypair) -> Pubkey {
    Pubkey::find_program_address(
        &[b"challenge", work_pda().as_ref(), who.pubkey().as_ref()],
        &lyrics_solana::id(),
    )
    .0
}
fn init_config_ix(payer: &Keypair, arbiter: &Keypair) -> Instruction {
    ix(
        lyrics_solana::instruction::InitConfig { arbiter: arbiter.pubkey() },
        lyrics_solana::accounts::InitConfig {
            config: config_pda(),
            payer: payer.pubkey(),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}
fn challenge_ix(who: &Keypair) -> Instruction {
    ix(
        lyrics_solana::instruction::Challenge { evidence_hash: [5u8; 32] },
        lyrics_solana::accounts::ChallengeWork {
            work: work_pda(),
            challenge: challenge_pda(who),
            challenger: who.pubkey(),
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}
fn resolve_ix(arbiter: &Keypair, challenger: &Keypair, upheld: bool) -> Instruction {
    ix(
        lyrics_solana::instruction::ResolveChallenge { upheld },
        lyrics_solana::accounts::ResolveChallenge {
            config: config_pda(),
            work: work_pda(),
            challenge: challenge_pda(challenger),
            arbiter: arbiter.pubkey(),
        }
        .to_account_metas(None),
    )
}

#[test]
fn solo_with_window_is_closing_then_finalizes() {
    let (ana, anyone) = (Keypair::new(), Keypair::new());
    let mut svm = setup(&[&ana, &anyone]);
    send(&mut svm, &ana, create_solo_window(&ana, 3_600)).unwrap();
    let w = work_of(&svm);
    assert!(w.status == Status::Closing);
    assert_eq!(w.contributors[0].bps, 10_000);
    assert!(send(&mut svm, &anyone, finalize_ix(&anyone)).is_err());
    warp(&mut svm, 3_601);
    send(&mut svm, &anyone, finalize_ix(&anyone)).unwrap();
    assert!(work_of(&svm).status == Status::Final);
}

#[test]
fn challenge_upheld_revokes_and_blocks_licensing() {
    let (ana, tercero, arbiter) = (Keypair::new(), Keypair::new(), Keypair::new());
    let mut svm = setup(&[&ana, &tercero, &arbiter]);
    send(&mut svm, &arbiter, init_config_ix(&arbiter, &arbiter)).unwrap();
    send(&mut svm, &ana, create_solo_window(&ana, 3_600)).unwrap();

    send(&mut svm, &tercero, challenge_ix(&tercero)).unwrap();
    assert!(work_of(&svm).status == Status::Disputed);
    // en disputa no se puede finalizar aunque venza la ventana
    warp(&mut svm, 3_601);
    assert!(send(&mut svm, &tercero, finalize_ix(&tercero)).is_err());

    send(&mut svm, &arbiter, resolve_ix(&arbiter, &tercero, true)).unwrap();
    assert!(work_of(&svm).status == Status::Revoked);
    assert!(send(&mut svm, &ana, license(&ana, true, SOL)).is_err());
    assert!(send(&mut svm, &ana, finalize_ix(&ana)).is_err());
}

#[test]
fn challenge_dismissed_restores_previous_status() {
    let (ana, tercero, arbiter) = (Keypair::new(), Keypair::new(), Keypair::new());
    let mut svm = setup(&[&ana, &tercero, &arbiter]);
    send(&mut svm, &arbiter, init_config_ix(&arbiter, &arbiter)).unwrap();
    send(&mut svm, &ana, create_solo_window(&ana, 0)).unwrap(); // Final
    send(&mut svm, &tercero, challenge_ix(&tercero)).unwrap();
    assert!(work_of(&svm).status == Status::Disputed);
    send(&mut svm, &arbiter, resolve_ix(&arbiter, &tercero, false)).unwrap();
    assert!(work_of(&svm).status == Status::Final);
    // no se puede resolver dos veces
    assert!(send(&mut svm, &arbiter, resolve_ix(&arbiter, &tercero, true)).is_err());
}

#[test]
fn only_arbiter_resolves_and_authors_cannot_challenge() {
    let (ana, tercero, arbiter) = (Keypair::new(), Keypair::new(), Keypair::new());
    let mut svm = setup(&[&ana, &tercero, &arbiter]);
    send(&mut svm, &arbiter, init_config_ix(&arbiter, &arbiter)).unwrap();
    send(&mut svm, &ana, create_solo_window(&ana, 3_600)).unwrap();
    assert!(send(&mut svm, &ana, challenge_ix(&ana)).is_err()); // autor: debe objetar
    send(&mut svm, &tercero, challenge_ix(&tercero)).unwrap();
    assert!(send(&mut svm, &tercero, resolve_ix(&tercero, &tercero, true)).is_err());
    assert!(send(&mut svm, &ana, resolve_ix(&ana, &tercero, false)).is_err());
}

#[test]
fn cannot_challenge_open_work_or_register_same_id_twice() {
    let (ana, tercero) = (Keypair::new(), Keypair::new());
    let mut svm = setup(&[&ana, &tercero]);
    send(&mut svm, &ana, create(&ana, [1u8; 32], 10, false)).unwrap();
    assert!(send(&mut svm, &tercero, challenge_ix(&tercero)).is_err()); // aún abierta
    // mismo work_id (huella de letra) no se puede registrar de nuevo
    assert!(send(&mut svm, &tercero, create(&tercero, [2u8; 32], 10, true)).is_err());
}
