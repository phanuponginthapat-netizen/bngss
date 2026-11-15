"""Read data-free Cloud doorbells; reconnects always reconcile through the API."""
def consume_receipts(response, reconcile):
    response.raise_for_status()
    # Default requests chunks wait for 512 bytes, delaying small SSE events.
    for line in response.iter_lines(chunk_size=1):
        if line in (b"event: ready", b"event: receipt", "event: ready", "event: receipt"):
            reconcile()