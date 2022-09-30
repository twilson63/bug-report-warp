import { test } from 'uvu'
import * as assert from 'uvu/assert'
import Arweave from 'arweave'
import { WarpNodeFactory } from 'warp1'
import ArLocal from 'arlocal'
import { assoc } from 'ramda'
import fs from 'fs'

let buyerWallet = {};
let sellerWallet = {};
let barContract = "";
let atomicSrc = "";
let assetContract = "";

//const GATEWAY = "1984-twilson63-bugreportwarp-x9vdw2p03ny.ws-us69.gitpod.io";

//const warp = window.warp.WarpWebFactory.forTesting(arweave);




test('ok', async () => {
  const arlocal = new ArLocal.default(1984, false)
  await arlocal.start()

  const arweave = Arweave.init({
    host: 'localhost',
    port: 1984,
    protocol: "http",
  });

  const warp = WarpNodeFactory.memCachedBased(arweave)
    .useArweaveGateway()
    .build();

  await setup(arweave)
  await arweave.api.get('mine')

  const so = await createSalesOrder(warp, arweave)
  assert.equal(so.state.balances[assetContract], 5000)

  const p = await purchaseAsset(warp, arweave)
  assert.equal(p[0].state.balances[sellerWallet.addr], 5000)
  assert.equal(p[0].state.balances[buyerWallet.addr], 10)

  assert.equal(p[1].state.balances[sellerWallet.addr], 1009800)
  assert.equal(p[1].state.balances[buyerWallet.addr], 990000)

  await arlocal.stop()
})

test.run()

async function purchaseAsset(warp, arweave) {
  const bar = warp
    .contract(barContract)
    .connect(buyerWallet.jwk)
    .setEvaluationOptions({
      internalWrites: true,
      allowBigInt: true,
    });

  const asset = warp
    .contract(assetContract)
    .connect(buyerWallet.jwk)
    .setEvaluationOptions({
      internalWrites: true,
      allowBigInt: true,
    });

  const result = await bar.writeInteraction({
    function: "allow",
    target: assetContract,
    qty: 10000,
  });

  await arweave.api.get('mine')
  await new Promise((resolve) => setTimeout(resolve, 500));

  const result2 = await asset.writeInteraction({
    function: "createOrder",
    pair: [barContract, assetContract],
    qty: 10000,
    transaction: result,
  });

  await arweave.api.get('mine')

  return Promise.all([asset.readState(), bar.readState()])
}

async function createSalesOrder(warp, arweave) {
  const contract = warp
    .contract(assetContract)
    .connect(sellerWallet.jwk)
    .setEvaluationOptions({
      internalWrites: true,
      allowBigInt: true,
    });

  const result = await contract.writeInteraction({
    function: "addPair",
    pair: barContract,
  });

  await arweave.api.get('mine')
  await new Promise((resolve) => setTimeout(resolve, 500));

  const contractResult = await contract.writeInteraction({
    function: "createOrder",
    qty: 5000,
    pair: [assetContract, barContract],
    price: 1000,
  });
  await arweave.api.get('mine')
  await new Promise((resolve) => setTimeout(resolve, 500));
  return await contract.readState();
}

async function setup(arweave) {
  // generate buyer Wallet
  buyerWallet = { jwk: await arweave.wallets.generate() };
  buyerWallet = assoc(
    "addr",
    await arweave.wallets.jwkToAddress(buyerWallet.jwk),
    buyerWallet
  );
  await arweave.api.get(
    `mint/${buyerWallet.addr}/${arweave.ar.arToWinston("1000")}`
  );
  // generate seller Wallet
  sellerWallet = { jwk: await arweave.wallets.generate() };
  sellerWallet = assoc(
    "addr",
    await arweave.wallets.jwkToAddress(sellerWallet.jwk),
    sellerWallet
  );
  await arweave.api.get(
    `mint/${sellerWallet.addr}/${arweave.ar.arToWinston("1000")}`
  );

  // deploy BAR Contract
  const src = fs.readFileSync('./tests/contracts/bar.js', 'utf-8')

  // deploy source transaction
  const srctx = await arweave.createTransaction({ data: src });
  srctx.addTag("App-Name", "SmartWeaveContractSource");
  srctx.addTag("App-Version", "0.3.0");
  srctx.addTag("Content-Type", "application/javascript");
  await arweave.transactions.sign(srctx, buyerWallet.jwk);
  await arweave.transactions.post(srctx);

  // deploy contract
  const tx = await arweave.createTransaction({
    data: JSON.stringify({
      balances: {
        [buyerWallet.addr]: 1000000,
        [sellerWallet.addr]: 1000000,
      },
      canEvolve: true,
      claimable: [],
      claims: [],
      creator: buyerWallet.addr,
      divisibility: 6,
      name: "BAR",
      settings: [["isTradeable", true]],
      ticker: "BAR",
    }),
  });
  tx.addTag("App-Name", "SmartWeaveContract");
  tx.addTag("Content-Type", "application/x.arweave-manifest+json");
  tx.addTag("Contract-Src", srctx.id);

  await arweave.transactions.sign(tx, buyerWallet.jwk);
  await arweave.transactions.post(tx);

  barContract = tx.id;
  // deploy BAR Contract
  const assetSrc = fs.readFileSync('./tests/contracts/asset.js', 'utf-8')

  // deploy source transaction
  const asrctx = await arweave.createTransaction({ data: assetSrc });
  asrctx.addTag("App-Name", "SmartWeaveContractSource");
  asrctx.addTag("App-Version", "0.3.0");
  asrctx.addTag("Content-Type", "application/javascript");
  await arweave.transactions.sign(asrctx, sellerWallet.jwk);
  await arweave.transactions.post(asrctx);

  atomicSrc = asrctx.id;
  await new Promise((resolve) => setTimeout(resolve, 500));

  // deploy Atomic contract
  const xtx = await arweave.createTransaction({
    data: "Hello World",
  });
  xtx.addTag("App-Name", "SmartWeaveContract");
  xtx.addTag("Content-Type", "application/x.arweave-manifest+json");
  xtx.addTag("Contract-Src", atomicSrc);
  xtx.addTag(
    "Init-State",
    JSON.stringify({
      balances: {
        [sellerWallet.addr]: 10000,
      },
      canEvolve: true,
      claimable: [],
      claims: [],
      foreignCalls: [],
      invocations: [],
      pairs: [],
      emergencyHaltWallet: sellerWallet.addr,
      settings: [["isTradeable", true]],
      ticker: "ASSET",
    })
  );
  await arweave.transactions.sign(xtx, sellerWallet.jwk);
  await arweave.transactions.post(xtx);
  assetContract = xtx.id;
  await new Promise((resolve) => setTimeout(resolve, 500));

}