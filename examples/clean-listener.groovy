// Synthetic ScriptRunner-like listener code. Intended to produce no findings.
import com.atlassian.jira.component.ComponentAccessor

def issue = event.issue
if (issue == null) {
    log.info("No issue attached to event")
    return
}
log.info("Listener invoked")
