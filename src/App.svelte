<script>
  import { Route, router } from "tinro";
  import Announcer from "./components/announcer.svelte";
  import Transition from "./components/transition.svelte";

  import Home from "./pages/home.svelte";
  import About from "./pages/about.svelte";
  import Warp1 from "./pages/warp-1-1.svelte";
  import Warp2 from "./pages/warp-1-2.svelte";

  router.mode.hash();
  router.subscribe((_) => window.scrollTo(0, 0));
</script>

<Announcer />
<Transition>
  <Route path="/">
    <Home />
  </Route>
  <Route path="/warp-1-1">
    <Warp1 />
  </Route>
  <Route path="/warp-1-2">
    <Warp2 />
  </Route>
  <Route path="/about">
    <About />
  </Route>
</Transition>
