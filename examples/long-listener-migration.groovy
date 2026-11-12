// Synthetic 120+ line Jira Data Center listener for testing ONLY
import com.atlassian.jira.component.ComponentAccessor
import com.atlassian.jira.event.issue.IssueEvent
def issueManager = ComponentAccessor.getIssueManager()
def userManager = ComponentAccessor.getUserManager()
if (event.issue != null) {
    def issue = issueManager.getIssueByCurrentKey("TEST-123")
    def summary = issue.getSummary()
    log.info("Synthetic migration review")
    if (summary) {
        issue.setSummary("Demo review")
    }
}

// Migration inventory: synthetic logging and per-feature placeholders
if (event.issue != null) {
    def cf = ComponentAccessor.getCustomFieldManager()
    def value = issue.getCustomFieldValue(cf)
    log.info("Synthetic custom field step")
}
def username = "dummy-user"
def user = userManager.getUserByName(username)
try {
    log.info("Synthetic try block")
} catch (Exception e) {
    log.warn("Synthetic error")
}
log.info("Synthetic safe output")
def localFlag = true
if (localFlag) {
    log.debug("Flag was set")
}
if (event.issue != null) {
    def cf = ComponentAccessor.getCustomFieldManager()
    def value = issue.getCustomFieldValue(cf)
    log.info("Synthetic custom field step")
}
def username = "dummy-user"
def user = userManager.getUserByName(username)
try {
    log.info("Synthetic try block")
} catch (Exception e) {
    log.warn("Synthetic error")
}
log.info("Synthetic safe output")
def localFlag = true
if (localFlag) {
    log.debug("Flag was set")
}
if (event.issue != null) {
    def cf = ComponentAccessor.getCustomFieldManager()
    def value = issue.getCustomFieldValue(cf)
    log.info("Synthetic custom field step")
}
def username = "dummy-user"
def user = userManager.getUserByName(username)
try {
    log.info("Synthetic try block")
} catch (Exception e) {
    log.warn("Synthetic error")
}
log.info("Synthetic safe output")
def localFlag = true
if (localFlag) {
    log.debug("Flag was set")
}
if (event.issue != null) {
    def cf = ComponentAccessor.getCustomFieldManager()
    def value = issue.getCustomFieldValue(cf)
    log.info("Synthetic custom field step")
}
def username = "dummy-user"
def user = userManager.getUserByName(username)
try {
    log.info("Synthetic try block")
} catch (Exception e) {
    log.warn("Synthetic error")
}
log.info("Synthetic safe output")
def localFlag = true
if (localFlag) {
    log.debug("Flag was set")
}
if (event.issue != null) {
    def cf = ComponentAccessor.getCustomFieldManager()
    def value = issue.getCustomFieldValue(cf)
    log.info("Synthetic custom field step")
}
def username = "dummy-user"
def user = userManager.getUserByName(username)
try {
    log.info("Synthetic try block")
} catch (Exception e) {
    log.warn("Synthetic error")
}
log.info("Synthetic safe output")
def localFlag = true
if (localFlag) {
    log.debug("Flag was set")
}
if (event.issue != null) {
    def cf = ComponentAccessor.getCustomFieldManager()
    def value = issue.getCustomFieldValue(cf)
    log.info("Synthetic custom field step")
}
def username = "dummy-user"
def user = userManager.getUserByName(username)
try {
    log.info("Synthetic try block")
} catch (Exception e) {
    log.warn("Synthetic error")
}
log.info("Synthetic safe output")
def localFlag = true
if (localFlag) {
    log.debug("Flag was set")
}
if (event.issue != null) {
    def cf = ComponentAccessor.getCustomFieldManager()
    def value = issue.getCustomFieldValue(cf)
    log.info("Synthetic custom field step")
}
def username = "dummy-user"
def user = userManager.getUserByName(username)
try {
    log.info("Synthetic try block")
} catch (Exception e) {
    log.warn("Synthetic error")
}
log.info("Synthetic safe output")
// End synthetic fixture
