"""Read data-free Cloud doorbells; reconnects always reconcile through the API."""
def consume_receipts(response, reconcile):
    response.raise_for_status()
    for line in response.iter_lines():
        if line in (b"event: ready", b"event: receipt", "event: ready", "event: receipt"):
            reconcile()