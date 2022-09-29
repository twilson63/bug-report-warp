<main>
  <section class="hero min-h-screen bg-base-100">
    <div class="hero-content flex-col">
      <h1 class="text-8xl font-bold">Bug Report</h1>
      <div class="prose">
        <p>
          This demo application showcases a bug with Warp SDK when using
          contracts with internalWrites.
        </p>
        <p>
          The each version returns different results, version 1.1 return a
          modified state as expected, version 1.2 returns an unmodified state
          with errors.
        </p>
        <div class="flex justify-center space-x-4">
          <a class="btn no-underline" href="/warp-1-1">Warp 1.1.x Demo</a>
          <a class="btn no-underline" href="/warp-1-2">Warp 1.2.x Demo</a>
        </div>
      </div>
    </div>
  </section>
</main>
