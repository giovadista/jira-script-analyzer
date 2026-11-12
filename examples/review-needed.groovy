// Synthetic teaching example — do not copy these patterns into production scripts.
def password = "placeholder-not-a-real-password"
println("starting")
// jsa-ignore JSA003
println("intentionally ignored diagnostic")
Thread.sleep(250)
try {
    def issues = getIssues()
    log.debug("Fetched issues")
} catch (Exception e) {
    e.printStackTrace()
}
