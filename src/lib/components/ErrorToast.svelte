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
    border: 2px solid #9b1c1c;
    border-radius: 8px;
    background: #fff5f5;
    color: #651313;
    box-shadow: 0 4px 18px #0003;
  }
  p {
    margin: 0.35rem 0 0.75rem;
  }
  button {
    cursor: pointer;
    padding: 0.45rem 0.7rem;
    border: 1px solid #651313;
    border-radius: 4px;
    background: #651313;
    color: white;
  }
  button:focus-visible {
    outline: 3px solid #1769aa;
    outline-offset: 2px;
  }
</style>
