import test from "node:test";
import assert from "node:assert/strict";
import {tokenizeGroovy,segmentGroovy} from "../docs/groovy-structure.js";
import {analyzeListenerMigration,migrationBlueprint,migrationMarkdown} from "../docs/listener-workbench.js";

const listener=[
 'import com.atlassian.jira.component.ComponentAccessor',
 'def manager = ComponentAccessor.getIssueManager()',
 'if (event.issue != null) {',
 '    def issue = manager.getIssueByCurrentKey("DEMO-123")',
 '    def summary = issue.getSummary()',
 '    log.info("demo logging")',
 '    issue.setSummary("changed")',
 '}'
].join("\n");
test("lexer preserves offsets and masks comments/strings",()=>{
 const src='def x = "ComponentAccessor"\n// event.issue\nlog.info("ok")';
 const l=tokenizeGroovy(src);
 assert.equal(l.mask.length,src.length);
 assert.ok(!l.mask.includes('ComponentAccessor'));
 assert.ok(!l.mask.includes("event.issue"));
 assert.equal(l.tokens.filter(x=>x.type==="literal").length,2);
});
test("lexer respects nested block comments and triple quotes",()=>{
 const src='/* outer /* inner */ event.issue */\n'+"def x = '''\nComponentAccessor\n'''\n"+
   'logger.info("ok")';
 const l=tokenizeGroovy(src);
 assert.equal(l.diagnostics.length,0);
 assert.ok(!l.mask.includes("ComponentAccessor"));
 assert.equal(l.tokens.filter(x=>x.value==="logger").length,1);
});
test("lexer recognizes slashy and dollar-slashy literals",()=>{
 const src='def pattern = /ComponentAccessor/\n'+'def dollar = $/event.issue/$\n';
 const l=tokenizeGroovy(src);
 assert.equal(l.tokens.filter(x=>x.type==="literal").length,2);
 assert.ok(!l.mask.includes("ComponentAccessor"));
 assert.ok(!l.mask.includes("event.issue"));
});
test("tokenizer signals malformed blocks rather than claiming success",()=>{
 const s=segmentGroovy('if(true) {\n println("ok")');
 assert.ok(s.diagnostics.some(d=>/Unbalanced/.test(d.reason)));
});
test("structural segments have source lines and control-flow nodes",()=>{
 const s=segmentGroovy(listener);
 assert.ok(s.segments.length>=7);
 assert.ok(s.segments.some(x=>x.kind==="block-open"&&x.lineStart===3));
 assert.ok(s.segments.every(x=>x.lineEnd>=x.lineStart));
});
test("complex listener maps safe reads and preserves manual write TODOs",()=>{
 const r=analyzeListenerMigration(listener);
 assert.equal(r.mode,"dc-listener-migration");
 assert.equal(r.source_lines,8);
 assert.ok(r.steps.some(x=>x.rule==="MANAGER-DC"));
 assert.ok(r.steps.some(x=>x.rule==="LOOKUP-STATIC"&&x.disposition==="candidate"));
 assert.ok(r.steps.some(x=>x.rule==="FIELD-READ"&&x.disposition==="candidate"));
 assert.ok(r.steps.some(x=>x.rule==="ISSUE-WRITE"&&x.disposition==="manual"));
 assert.ok(r.steps.some(x=>x.rule==="FLOW-EVENT"&&x.disposition==="structural"));
 assert.ok(r.controls.some(x=>x.id==="idempotency"));
});
test("line-level plan locates changes correctly",()=>{
 const r=analyzeListenerMigration(listener);
 const write=r.steps.find(x=>x.rule==="ISSUE-WRITE");
 assert.equal(write.lineStart,7);
 assert.ok(write.advice.includes("PUT"));
 assert.ok(r.source_mapping.every(x=>x.from>0&&x.to<=8));
});
test("migration blueprint contains only commented snippets, never runnable script",()=>{
 const r=analyzeListenerMigration(listener);
 const plan=migrationBlueprint(r);
 assert.match(plan,/NOT EXECUTABLE/);
 assert.ok(plan.split("\n").filter(Boolean).every(line=>line.startsWith("//")));
 assert.ok(plan.includes("/rest/api/3/issue/DEMO-123"));
 assert.ok(plan.includes("ISSUE-WRITE"));
});
test("Markdown plan includes code candidates, manual steps and source map",()=>{
 const r=analyzeListenerMigration(listener);
 const md=migrationMarkdown(r);
 assert.ok(md.includes("Line-mapped inventory"));
 assert.ok(md.includes("lines 7–7"));
 assert.ok(md.includes("acceptance gates"));
});
test("long DC listeners are segmented with exact line mapping",()=>{
 const lines=['import com.atlassian.jira.component.ComponentAccessor',
  'def mgr = ComponentAccessor.getIssueManager()'];
 for(let i=0;i<110;i++){
  lines.push('log.info("test "+'+i+')');
  lines.push('def n'+i+' = '+i);
 }
 lines.push('def result = mgr.getIssueByCurrentKey("DEMO-999")');
 const report=analyzeListenerMigration(lines.join("\n"));
 assert.equal(report.source_lines,223);
 const lookup=report.steps.find(x=>x.rule==="LOOKUP-STATIC");
 assert.equal(lookup.lineStart,223);
 assert.ok(report.statements_analyzed>=220);
});
test("source with secrets is never echoed in reports or plans",()=>{
 const sensitive='def clientSecret = "DO_NOT_EXPOSE_123456"\n'+
   'issue.setSummary(clientSecret)';
 const report=analyzeListenerMigration(sensitive);
 assert.ok(!JSON.stringify(report).includes("DO_NOT_EXPOSE_123456"));
 assert.ok(!migrationMarkdown(report).includes("DO_NOT_EXPOSE_123456"));
 assert.ok(!migrationBlueprint(report).includes("DO_NOT_EXPOSE_123456"));
});
test("unknown Groovy calls remain explicit manual tasks",()=>{
 const report=analyzeListenerMigration('myCompanySecretMethod("x")');
 assert.equal(report.steps[0].disposition,"manual");
 assert.equal(report.steps[0].rule,"UNKNOWN");
});
test("listener input size and type limits enforced",()=>{
 assert.throws(()=>analyzeListenerMigration(""),/Paste/);
 assert.throws(()=>analyzeListenerMigration("x".repeat(1024*1024+1)),/1 MB/);
 assert.throws(()=>analyzeListenerMigration(null),/Paste/);
});
test("no original source content appears in arbitrary manual steps",()=>{
 const r=analyzeListenerMigration('def token = "NEVERCOPY"\ncustomOperation(token)');
 assert.ok(!JSON.stringify(r).includes("NEVERCOPY"));
});

test("invalid structural source disables all Cloud candidate snippets",()=>{
 const source='def issue = ComponentAccessor.getIssueManager().getIssueByCurrentKey("TEST-42")\nif (true) {';
 const r=analyzeListenerMigration(source);
 assert.ok(r.lexical_diagnostics.length>0);
 assert.equal(r.steps.filter(x=>x.disposition==="candidate").length,0);
 assert.equal(r.steps.filter(x=>x.snippet).length,0);
 assert.ok(r.steps.some(x=>x.rule==="PARSE-BLOCKED"));
});
test("Forge event guard is explicitly recognized as context-sensitive",()=>{
 const r=analyzeListenerMigration('if (event.issue != null) { log.info("ok") }');
 assert.equal(r.steps[0].rule,"FLOW-EVENT");
 assert.equal(r.steps[0].severity,"HIGH");
});
