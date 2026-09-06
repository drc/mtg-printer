<script lang="ts">
  export let busy = false;
  export let onadd: (url: string) => Promise<boolean>;
  let url = "";
  let input: HTMLInputElement;
  async function submit() {
    if (await onadd(url)) {
      url = "";
      input?.focus();
    }
  }
</script>

<section aria-labelledby="link-heading">
  <h2 id="link-heading">Add a card link</h2>
  <form
    onsubmit={(event) => {
      event.preventDefault();
      submit();
    }}>
    <label for="card-url">Scryfall card URL</label>
    <input bind:this={input} id="card-url" bind:value={url} type="url" placeholder="https://scryfall.com/card/slz/3/eerie-interlude" />
    <button type="submit" disabled={busy || !url.trim()}>Add card</button>
  </form>
</section>
