<script>
  import { assoc } from "ramda";
  import { onMount } from "svelte";

  let buyerWallet = {};
  let sellerWallet = {};
  let barContract = "";
  let atomicSrc = "";
  let assetContract = "";

  //const GATEWAY = "1984-twilson63-bugreportwarp-01paf0rtjc4.ws-us67.gitpod.io";

  const GATEWAY = "testnet.redstone.tools";
  const arweave = window.Arweave.init({
    host: GATEWAY,
    port: 443,
    protocol: "https",
  });

  //const warp = window.warp.WarpWebFactory.forTesting(arweave);
  let warp = onMount(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    warp = window.warp.WarpWebFactory.memCachedBased(arweave)
      .useArweaveGateway()
      .build();
  });

  async function setup() {
    // generate buyer Wallet
    buyerWallet = { jwk: await arweave.wallets.generate() };
    log("generate buyer Wallet JWK");
    buyerWallet = assoc(
      "addr",
      await arweave.wallets.jwkToAddress(buyerWallet.jwk),
      buyerWallet
    );
    log("get buyer Wallet Address - " + buyerWallet.addr);
    await arweave.api.get(
      `mint/${buyerWallet.addr}/${arweave.ar.arToWinston("1000")}`
    );
    log("mint 100 $AR for buyer wallet");
    // generate seller Wallet
    sellerWallet = { jwk: await arweave.wallets.generate() };
    log("generate seller Wallet JWK");
    sellerWallet = assoc(
      "addr",
      await arweave.wallets.jwkToAddress(sellerWallet.jwk),
      sellerWallet
    );
    log("get seller Wallet Address - " + sellerWallet.addr);
    await arweave.api.get(
      `mint/${sellerWallet.addr}/${arweave.ar.arToWinston("1000")}`
    );
    log("mint 100 $AR for seller wallet");

    // deploy BAR Contract
    const src = await fetch("bar.js").then((res) => res.text());
    log("fetched BAR Source");
    // deploy source transaction
    const srctx = await arweave.createTransaction({ data: src });
    srctx.addTag("App-Name", "SmartWeaveContractSource");
    srctx.addTag("App-Version", "0.3.0");
    srctx.addTag("Content-Type", "application/javascript");
    await arweave.transactions.sign(srctx, buyerWallet.jwk);
    await arweave.transactions.post(srctx);
    log("deployed contract source - " + srctx.id);

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
    log("deployed BAR contract - " + tx.id);
    barContract = tx.id;
    // deploy BAR Contract
    const assetSrc = await fetch("atomic-asset.js").then((res) => res.text());
    log("fetched AtomicAsset Source");
    // deploy source transaction
    const asrctx = await arweave.createTransaction({ data: assetSrc });
    asrctx.addTag("App-Name", "SmartWeaveContractSource");
    asrctx.addTag("App-Version", "0.3.0");
    asrctx.addTag("Content-Type", "application/javascript");
    await arweave.transactions.sign(asrctx, sellerWallet.jwk);
    await arweave.transactions.post(asrctx);
    log("deployed atomic contract source - " + asrctx.id);
    atomicSrc = asrctx.id;
    await new Promise((resolve) => setTimeout(resolve, 500));
    log("setup complete!");
  }

  async function createAsset() {
    log2("creating atomic asset");
    // deploy Atomic contract
    const tx = await arweave.createTransaction({
      data: "Hello World",
    });
    tx.addTag("App-Name", "SmartWeaveContract");
    tx.addTag("Content-Type", "application/x.arweave-manifest+json");
    tx.addTag("Contract-Src", atomicSrc);
    tx.addTag(
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
    await arweave.transactions.sign(tx, sellerWallet.jwk);
    await arweave.transactions.post(tx);
    log2("deployed Atomic contract - " + tx.id);
    assetContract = tx.id;
    await new Promise((resolve) => setTimeout(resolve, 500));
    log2("create asset is complete!");
  }

  async function createSalesOrder() {
    log3("getting current state");
    const contract = warp
      .contract(assetContract)
      .connect(sellerWallet.jwk)
      .setEvaluationOptions({
        internalWrites: true,
        allowBigInt: true,
      });

    // const status = await contract.readState();
    // log3(JSON.stringify(status, null, 2));

    log3("adding bar contract to asset contract");

    const result = await contract.writeInteraction({
      function: "addPair",
      pair: barContract,
    });

    log3(JSON.stringify(result, null, 2));
    await new Promise((resolve) => setTimeout(resolve, 500));
    log3("getting new state");

    log3(JSON.stringify(await contract.readState(), null, 2));

    // create Order
    log3("Creating Sale Order");
    const contractResult = await contract.writeInteraction({
      function: "createOrder",
      qty: 5000,
      pair: [assetContract, barContract],
      price: 1000,
    });

    log3(JSON.stringify(contractResult, null, 2));
    await new Promise((resolve) => setTimeout(resolve, 500));

    log3(JSON.stringify(await contract.readState(), null, 2));
    await new Promise((resolve) => setTimeout(resolve, 500));
    log3("create sales order complete!");
  }

  async function purchaseOrder() {
    log4("creating purchase Order");
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

    log4("allow order");

    const result = await bar.writeInteraction({
      function: "allow",
      target: assetContract,
      qty: 10000,
    });
    log4(JSON.stringify(result, null, 2));

    await new Promise((resolve) => setTimeout(resolve, 500));

    log4(JSON.stringify(await bar.readState(), null, 2));

    log4("create purchase order");

    const result2 = await asset.writeInteraction({
      function: "createOrder",
      pair: [barContract, assetContract],
      qty: 10000,
      transaction: result,
    });

    log4(JSON.stringify(result2, null, 2));

    await new Promise((resolve) => setTimeout(resolve, 500));
    log4("Asset State");
    log4(JSON.stringify(await asset.readState(), null, 2));
    log4("Bar State");
    log4(JSON.stringify(await bar.readState(), null, 2));
    await new Promise((resolve) => setTimeout(resolve, 500));
    log4("create purchase complete!");
  }

  let setupOutput = "";
  let createAssetOutput = "";
  let createSaleOutput = "";
  let purchaseOutput = "";

  async function log(txt) {
    await arweave.api.get("mine");
    setupOutput += `<pre><code>${txt}</code></pre>`;
  }

  async function log2(txt) {
    await arweave.api.get("mine");
    createAssetOutput += `<pre><code>${txt}</code></pre>`;
  }

  async function log3(txt) {
    await arweave.api.get("mine");
    createSaleOutput += `<pre><code>${txt}</code></pre>`;
  }

  async function log4(txt) {
    await arweave.api.get("mine");
    purchaseOutput += `<pre><code>${txt}</code></pre>`;
  }
</script>

<svelte:head>
  <script
    src="https://unpkg.com/warp-contracts@1.1.14/bundles/web.bundle.min.js"></script>
</svelte:head>
<nav class="h-[72px] bg-gray-300 flex items-center justify-center">
  <a class="btn btn-ghost" href="/">Back to home</a>
</nav>
<div class="mt-8 hero min-h-screen items-start">
  <div class="hero-content flex-col">
    <h1 class="text-4xl">Warp 1.1 Tradeable Atomic Asset Demo</h1>
    <div class="prose">
      <p class="mt-8 text-center">
        The purpose of this demo is to showcase the Tradeable Atomic Asset
        process. This process takes any PST Contract and uses Verto to make it
        tradeabble. The tradeable nature of this contract will allow it to be
        exchanged from seller wallet to buyer while allowing for the utility
        coin to be exhanged from buyer wallet to seller wallet.
      </p>
      <h2>Setup</h2>
      <p>In the setup, we will need to create:</p>
      <ul>
        <li>
          Seller Wallet - we will need to generate and mint winston for this
          wallet
        </li>
        <li>
          Buyer Wallet - we will generate and mint winston for this wallet
        </li>
        <li>A BAR Contract - This contract will serve as our utility coin</li>
        <li>
          Tradeable Asset Contract Source - This is the source that will be used
          to deploy the tradeable asset contract.
        </li>
      </ul>
      <div class="my-8">
        <button class="btn btn-outline" on:click={setup}>Run Setup</button>
      </div>
    </div>
    {#if true}
      <div class="mockup-code w-full">
        {@html setupOutput}
      </div>
    {/if}
    <!-- Create Tradeable Atomic Asset -->
    <div class="flex flex-col space-y-4">
      <div class="prose">
        <h2>Create Atomic Asset</h2>
        <p>
          Using the contract src {atomicSrc} we will create an Atomic Asset for the
          text 'Hello World'
        </p>
      </div>
    </div>
    <div class="my-8 flex">
      <button class="btn btn-outline" on:click={createAsset}
        >Create Asset</button
      >
    </div>
    <div class="mockup-code w-full">
      {@html createAssetOutput}
    </div>
    <!-- Sale 50% of asset for 0.01 BAR -->
    <div class="flex flex-col space-y-4">
      <div class="prose">
        <h2>Sale Asset</h2>
        <p>
          Now that we have an Asset {assetContract || "N/A"} lets create a Sales
          Order for some BAR, to do this we need to add the BAR contract {barContract ||
            "N/A"} as a trade pair, then we can create a sales order.
        </p>
      </div>
    </div>
    <div class="my-8 flex">
      <button class="btn btn-outline" on:click={createSalesOrder}
        >Create Sales Order</button
      >
    </div>
    <div class="mockup-code w-full">
      {@html createSaleOutput}
    </div>
    <!-- Purchase Asset -->
    <div class="flex flex-col space-y-4">
      <div class="prose">
        <h2>Purchase Asset</h2>
      </div>
    </div>
    <div class="my-8 flex">
      <button class="btn btn-outline" on:click={purchaseOrder}
        >Purchase Asset</button
      >
    </div>
    <div class="mockup-code w-full">
      {@html purchaseOutput}
    </div>
    <div class="prose">
      <h3>Success!</h3>
      <p>
        If you have made it this for, then you have successfully walked through
        a trade of an atomic asset ✨
      </p>
    </div>
  </div>
</div>
