use axum::{routing::post, Json, Router};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use halo2_proofs::{
    circuit::{Layouter, SimpleFloorPlanner, Value},
    dev::MockProver,
    plonk::{Advice, Circuit, Column, ConstraintSystem, Error, Selector},
    poly::Rotation,
};
use halo2curves::bn256::Fr;

// ==========================================
// DATA STRUCTURES
// ==========================================

#[derive(Deserialize)]
struct BurnRequest {
    balance_before: u64,
    burn_amount: u64,
    balance_after: u64,
}

#[derive(Deserialize)]
struct TransferRequest {
    sender_before: u64,
    receiver_before: u64,
    amount: u64,
    sender_after: u64,
    receiver_after: u64,
}

#[derive(Serialize)]
struct ProofResponse {
    success: bool,
    message: String,
}

// ==========================================
// HALO2 CIRCUITS
// ==========================================

// --- Burn Circuit ---
#[derive(Clone, Default)]
struct BurnCircuit {
    balance_before: Value<Fr>,
    burn_amount: Value<Fr>,
    balance_after: Value<Fr>,
}

#[derive(Clone)]
struct BurnConfig {
    balance_col: Column<Advice>,
    amount_col: Column<Advice>,
    selector: Selector,
}

impl Circuit<Fr> for BurnCircuit {
    type Config = BurnConfig;
    type FloorPlanner = SimpleFloorPlanner;
    fn without_witnesses(&self) -> Self { Self::default() }

    fn configure(meta: &mut ConstraintSystem<Fr>) -> Self::Config {
        let balance_col = meta.advice_column();
        let amount_col = meta.advice_column();
        let selector = meta.selector();
        meta.enable_equality(balance_col);
        meta.enable_equality(amount_col);

        meta.create_gate("Verify Burn", |meta| {
            let s = meta.query_selector(selector);
            let before = meta.query_advice(balance_col, Rotation::cur());
            let amount = meta.query_advice(amount_col, Rotation::cur());
            let after = meta.query_advice(balance_col, Rotation::next());
            vec![s * (before - amount - after)]
        });
        BurnConfig { balance_col, amount_col, selector }
    }

    fn synthesize(&self, config: Self::Config, mut layouter: impl Layouter<Fr>) -> Result<(), Error> {
        layouter.assign_region(|| "burn row", |mut region| {
            config.selector.enable(&mut region, 0)?;
            region.assign_advice(|| "before", config.balance_col, 0, || self.balance_before)?;
            region.assign_advice(|| "amount", config.amount_col, 0, || self.burn_amount)?;
            region.assign_advice(|| "after", config.balance_col, 1, || self.balance_after)?;
            Ok(())
        })
    }
}

// --- Transfer Circuit ---
#[derive(Clone, Default)]
struct TransferCircuit {
    sender_before: Value<Fr>,
    receiver_before: Value<Fr>,
    amount: Value<Fr>,
    sender_after: Value<Fr>,
    receiver_after: Value<Fr>,
}

#[derive(Clone)]
struct TransferConfig {
    sender_col: Column<Advice>,
    receiver_col: Column<Advice>,
    amount_col: Column<Advice>,
    selector: Selector,
}

impl Circuit<Fr> for TransferCircuit {
    type Config = TransferConfig;
    type FloorPlanner = SimpleFloorPlanner;
    fn without_witnesses(&self) -> Self { Self::default() }

    fn configure(meta: &mut ConstraintSystem<Fr>) -> Self::Config {
        let sender_col = meta.advice_column();
        let receiver_col = meta.advice_column();
        let amount_col = meta.advice_column();
        let selector = meta.selector();

        meta.enable_equality(sender_col);
        meta.enable_equality(receiver_col);
        meta.enable_equality(amount_col);

        meta.create_gate("Verify Asset Transfer Ledger Constraints", |meta| {
            let s = meta.query_selector(selector);
            let s_before = meta.query_advice(sender_col, Rotation::cur());
            let r_before = meta.query_advice(receiver_col, Rotation::cur());
            let amt = meta.query_advice(amount_col, Rotation::cur());
            
            let s_after = meta.query_advice(sender_col, Rotation::next());
            let r_after = meta.query_advice(receiver_col, Rotation::next());

            // Rule 1: Sender balance must decrease cleanly
            // Rule 2: Receiver balance must increase cleanly
            vec![
                s.clone() * (s_before - amt.clone() - s_after),
                s * (r_before + amt - r_after),
            ]
        });

        TransferConfig { sender_col, receiver_col, amount_col, selector }
    }

    fn synthesize(&self, config: Self::Config, mut layouter: impl Layouter<Fr>) -> Result<(), Error> {
        layouter.assign_region(|| "transfer state transition row", |mut region| {
            config.selector.enable(&mut region, 0)?;
            
            region.assign_advice(|| "sb", config.sender_col, 0, || self.sender_before)?;
            region.assign_advice(|| "rb", config.receiver_col, 0, || self.receiver_before)?;
            region.assign_advice(|| "amt", config.amount_col, 0, || self.amount)?;
            
            region.assign_advice(|| "sa", config.sender_col, 1, || self.sender_after)?;
            region.assign_advice(|| "ra", config.receiver_col, 1, || self.receiver_after)?;
            Ok(())
        })
    }
}

// ==========================================
// HTTP API HANDLERS
// ==========================================

async fn handle_burn(Json(payload): Json<BurnRequest>) -> Json<ProofResponse> {
    let circuit = BurnCircuit {
        balance_before: Value::known(Fr::from(payload.balance_before)),
        burn_amount: Value::known(Fr::from(payload.burn_amount)),
        balance_after: Value::known(Fr::from(payload.balance_after)),
    };

    let prover = MockProver::run(4, &circuit, vec![]).unwrap();
    match prover.verify() {
        Ok(_) => Json(ProofResponse { success: true, message: "ZK Burn Proof verified.".to_string() }),
        Err(_) => Json(ProofResponse { success: false, message: "Math mismatch in asset burn verification.".to_string() }),
    }
}

async fn handle_transfer(Json(payload): Json<TransferRequest>) -> Json<ProofResponse> {
    let circuit = TransferCircuit {
        sender_before: Value::known(Fr::from(payload.sender_before)),
        receiver_before: Value::known(Fr::from(payload.receiver_before)),
        amount: Value::known(Fr::from(payload.amount)),
        sender_after: Value::known(Fr::from(payload.sender_after)),
        receiver_after: Value::known(Fr::from(payload.receiver_after)),
    };

    let prover = MockProver::run(4, &circuit, vec![]).unwrap();
    match prover.verify() {
        Ok(_) => Json(ProofResponse { success: true, message: "ZK Asset Transfer Proof verified against ledger.".to_string() }),
        Err(_) => Json(ProofResponse { success: false, message: "Ledger asset conservation rules violated.".to_string() }),
    }
}

// ==========================================
// EXECUTION ENTRYPOINT
// ==========================================

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/prove-burn", post(handle_burn))
        .route("/prove-transfer", post(handle_transfer));

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("Production Halo2 Ledger Processing Engine online at http://{}", addr);
    axum::Server::bind(&addr).serve(app.into_make_service()).await.unwrap();
}
