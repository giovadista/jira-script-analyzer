import test from "node:test";
import assert from "node:assert/strict";
import {convertDcScript,CONVERTER_VERSION} from "../docs/converter.js";

test("converter version present",()=>assert.equal(CONVERTER_VERSION,"0.2.0"));
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

test("read-only summary accessor converts to Cloud map field",()=>{
 const code='import com.atlassian.jira.component.ComponentAccessor\n'+
  'def issue = ComponentAccessor.getIssueManager().getIssueByCurrentKey("ABC-12")\n'+
  'def summary = issue.getSummary()';
 const r=convertDcScript(code);
 assert.equal(r.status,"candidate");
 assert.match(r.generated_code,/def summary = issue.fields.summary/);
 assert.equal(r.confidence,"medium");
});
test("read-only status and project fields have supported mappings",()=>{
 for(const [accessor,path] of [["getStatus().getName()","fields.status.name"],
                               ["getProjectObject().getKey()","fields.project.key"],
                               ["getKey()","key"]]){
   const code='def item = ComponentAccessor.getIssueManager().getIssueByCurrentKey("ABC-12")\n'+
     'def result = item.'+accessor;
   const r=convertDcScript(code);
   assert.equal(r.status,"candidate",accessor);
   assert.ok(r.generated_code.includes("def result = item."+path),accessor);
 }
});
test("unsafe mutation is not converted but receives REST guidance",()=>{
 const code='def issue = ComponentAccessor.getIssueManager().getIssueByCurrentKey("ABC-12")\n'+
            'issue.setSummary("modified")';
 const r=convertDcScript(code);
 assert.equal(r.status,"manual-review");
 assert.ok(!r.generated_code.includes('put('));
 assert.ok(r.review_tasks.some(x=>x.id==="write"));
});
test("comment and transition logic has categorized manual instructions",()=>{
 const r=convertDcScript("createComment(issue, user, 'hi')\ntransitionIssue(issue)");
 assert.equal(r.status,"manual-review");
 assert.ok(r.review_tasks.some(x=>x.id==="comment"));
 assert.ok(r.review_tasks.some(x=>x.id==="transition"));
});
test("script literal containing extra expression is rejected",()=>{
 const code='def item = ComponentAccessor.getIssueManager().getIssueByCurrentKey("ABC-12")\n'+
   'def summary = item.getSummary() + secret';
 assert.equal(convertDcScript(code).status,"manual-review");
});
test("script with extra import is rejected",()=>{
 const code='import java.io.File\n'+
  'def item = ComponentAccessor.getIssueManager().getIssueByCurrentKey("ABC-12")';
 assert.equal(convertDcScript(code).status,"manual-review");
});
test("credentials stay out of notes and generated code",()=>{
 const source='def password = "SUPER_SECRET_8675309"\nissue.setSummary(password)';
 const r=convertDcScript(source);
 assert.equal(r.status,"manual-review");
 assert.ok(!JSON.stringify(r).includes("SUPER_SECRET_8675309"));
});
