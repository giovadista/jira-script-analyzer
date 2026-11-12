import test from "node:test";
import assert from "node:assert/strict";
import {convertDcScript,CONVERTER_VERSION} from "../docs/converter.js";

test("converter version present",()=>assert.equal(CONVERTER_VERSION,"0.1.0"));
test("isolated DC issue lookup generates REST candidate",()=>{
 const input='import com.atlassian.jira.component.ComponentAccessor\n'+
   'def issue = ComponentAccessor.getIssueManager().getIssueByCurrentKey("TEST-123")';
 const r=convertDcScript(input,"console");
 assert.equal(r.status,"candidate");
 assert.equal(r.recipe,"DC_ISSUE_LOOKUP");
 assert.ok(r.generated_code.includes('/rest/api/3/issue/TEST-123'));
 assert.ok(r.generated_code.includes("def issue = response.body"));
 assert.ok(!r.generated_code.includes("ComponentAccessor"));
});
test("single-quoted lookup and job context are supported",()=>{
 const r=convertDcScript("def item = ComponentAccessor.getIssueManager().getIssueByCurrentKey('ABC_1-123')","job");
 assert.equal(r.status,"candidate");
 assert.ok(r.generated_code.includes("ABC_1-123"));
});
test("multi-statement input is not falsely converted",()=>{
 const r=convertDcScript('def issue = ComponentAccessor.getIssueManager().getIssueByCurrentKey("ABC-2")\nissue.setSummary("changed")');
 assert.equal(r.status,"manual-review");
 assert.ok(!r.generated_code.includes('get("/rest/api/3/issue/'));
});
test("dynamic issue key cannot produce automatic rewrite",()=>{
 const r=convertDcScript('def issue = ComponentAccessor.getIssueManager().getIssueByCurrentKey(issueKey)');
 assert.equal(r.status,"manual-review");
});
test("unsupported execution context blocks automatic candidate",()=>{
 const r=convertDcScript('def issue = ComponentAccessor.getIssueManager().getIssueByCurrentKey("ABC-22")',"workflow");
 assert.equal(r.status,"manual-review");
 assert.match(r.generated_code,/MANUAL CONVERSION/);
});
test("HAPI candidate requires manual verification",()=>{
 const r=convertDcScript('def issue = Issues.getByKey("ABC-123")',"console");
 assert.equal(r.status,"candidate");
 assert.match(r.generated_code,/Verify HAPI support/);
});
test("invalid contexts and input are rejected",()=>{
 assert.throws(()=>convertDcScript(""),/Paste/);
 assert.throws(()=>convertDcScript("log.info('hello')","unknown"),/Unsupported/);
 assert.throws(()=>convertDcScript("a".repeat(1024*1024+1)),/1 MB/);
});
test("conversion never includes original secret",()=>{
 const secret='def password = "NEVER_SHARE_THIS"';
 const result=convertDcScript(secret);
 assert.equal(result.status,"manual-review");
 assert.ok(!JSON.stringify(result).includes("NEVER_SHARE_THIS"));
});
test("unrecognized server-specific behavior stays manual",()=>{
 const result=convertDcScript("ComponentAccessor.getIssueManager().getIssueByCurrentKey('AAA-1').setSummary('x')");
 assert.equal(result.status,"manual-review");
});
