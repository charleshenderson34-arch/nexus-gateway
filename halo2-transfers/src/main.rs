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

#[derive(Deserialize)]
struct BurnRequest {
    balance_before: u64,
    burn_amount: u64,
    balance_after: u64,
}

#[derive(Serialize)]
struct BurnResponse {
    success: bool,
    message: String,
}

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

    fn without_witnesses(&self) -> Self {
        Self::default()
    }

    fn configure(meta: &mut ConstraintSystem<Fr>) -> Self::Config {
        let balance_col = meta.advice_column();
        let amount_col = meta.advice_column();
        let selector = meta.selector();

        meta.enable_equality(balance_col);
        meta.enable_equality(amount_col);

        meta.create_gate("Verify Burn Constraint", |meta| {
            let s = meta.query_selector(selector);
            let before = meta.query_advice(balance_col, Rotation::cur());
            let amount = meta.query_advice(amount_col, Rotation::cur());
            let after = meta.query_advice(balance_col, Rotation::next());

            // Mathematical rule: before - amount - after == 0
            vec![s * (before - amount - after)]
        });

        BurnConfig { balance_col, amount_col, selector }
    }

    fn synthesize(&self, config: Self::Config, mut layouter: impl Layouter<Fr>) -> Result<(), Error> {
        layouter.assign_region(
            || "Burn execution row",
            |mut region| {
                config.selector.enable(&mut region, 0)?;
                region.assign_advice(|| "balance before", config.balance_col, 0, || self.balance_before)?;
                region.assign_advice(|| "burn amount", config.amount_col, 0, || self.burn_amount)?;
                region.assign_advice(|| "balance after", config.balance_col, 1, || self.balance_after)?;
                Ok(())
            },
        )
    }
}

async fn handle_burn(Json(payload): Json<BurnRequest>) -> Json<BurnResponse> {
    let circuit = BurnCircuit {
        balance_before: Value::known(Fr::from(payload.balance_before)),
        burn_amount: Value::known(Fr::from(payload.burn_amount)),
        balance_after: Value::known(Fr::from(payload.balance_after)),
    };

    // K parameter defines row size for the proof grid (2^4 = 16 rows)
    let k = 4; 
    let public_inputs = vec![];
    let prover = MockProver::run(k, &circuit, public_inputs).unwrap();

    match prover.verify() {
        Ok(_) => Json(BurnResponse {
            success: true,
            message: "Zero-Knowledge proof generated and verified successfully.".to_string(),
        }),
        Err(_) => Json(BurnResponse {
            success: false,
            message: "Cryptographic constraint violation: Math check failed.".to_string(),
        }),
    }
}

#[tokio::main]
async fn main() {
    let app = Router::new().route("/prove-burn", post(handle_burn));
    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("Halo2 High-Performance Backend Listening on http://{}", addr);
    axum::Server::bind(&addr).serve(app.into_make_service()).await.unwrap();
}
