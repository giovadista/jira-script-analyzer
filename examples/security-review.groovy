// Synthetic source review fixture; no real credentials or production systems.
def clientSecret = "FAKE-SAMPLE"
def proc = new ProcessBuilder("echo", "test")
def connection = URL("https://example.invalid")
log.debug("Synthetic diagnostic")
