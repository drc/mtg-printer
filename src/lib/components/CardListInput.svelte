<script lang="ts">
  export let busy = false;
  export let onadd: (names: string[]) => Promise<boolean>;
  let names = "";
  let input: HTMLTextAreaElement;
  async function submit() {
    if (await onadd(names.split("\n"))) {
      names = "";
      input?.focus();
    }
  }
</script>

<section aria-labelledby="list-heading">
  <h2 id="list-heading">Paste names</h2>
  <form
    onsubmit={(event) => {
      event.preventDefault();
      submit();
    }}>
    <label for="names">One card name per line</label>
    <textarea bind:this={input} id="names" bind:value={names} rows="4" placeholder="Lightning Bolt&#10;Counterspell"></textarea>
    <button type="submit" disabled={busy || !names.trim()}>Add list</button>
  </form>
</section>
