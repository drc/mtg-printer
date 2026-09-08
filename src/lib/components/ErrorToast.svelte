<script lang="ts">
  export let message: string;
  export let onclose: () => void;
</script>

<div class="toast" role="alert" aria-live="assertive">
  <strong>Something went wrong</strong>
  <p>{message}</p>
  <button type="button" aria-label="Dismiss error" onclick={onclose}>Dismiss</button>
</div>

<style>
  .toast {
    position: fixed;
    right: 1rem;
    bottom: 1rem;
    z-index: 10;
    width: min(28rem, calc(100vw - 2rem));
    padding: 1rem;
    border: 2px solid var(--error-border);
    border-radius: 8px;
    background: var(--error-bg);
    color: var(--error-text);
    box-shadow: 0 4px 18px rgb(0 0 0 / 25%);
  }
  p {
    margin: 0.35rem 0 0.75rem;
  }
  button {
    cursor: pointer;
    padding: 0.45rem 0.7rem;
    border: 1px solid var(--error-text);
    border-radius: 4px;
    background: var(--error-text);
    color: var(--surface);
  }
  button:focus-visible {
    outline: 3px solid var(--accent);
    outline-offset: 2px;
  }
</style>
