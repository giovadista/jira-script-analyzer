import json
import tempfile
import unittest
from pathlib import Path
from analyzer import analyze, main, mask_non_code, render_html, scan, to_csv, to_sarif, RULES, VERSION

class LexerTests(unittest.TestCase):
    def test_comments_and_strings(self):
        source = '// println("ignored")\n/* Thread.sleep(1) */\ndef msg = "println(1)"\nprintln("ok")'
        self.assertEqual([(f.rule, f.line) for f in analyze(source, 'test.groovy')], [('JSA003', 4)])

    def test_multiline_quote(self):
        text = "'''\nprintln(1)\n'''\nThread.sleep(3)"
        self.assertEqual([(f.rule, f.line) for f in analyze(text, 'test.groovy')], [('JSA002', 4)])
        self.assertEqual(len(mask_non_code(text)), len(text))

    def test_nested_block_comment(self):
        text = "/* outer /* inner */ println(1) */\nprintln(2)"
        self.assertEqual([f.line for f in analyze(text, 'test.groovy')], [2])

    def test_credentials_and_comment(self):
        source = '// password = "fake"\ndef apiToken = "demo"\n'
        self.assertEqual([(f.rule, f.line) for f in analyze(source, 'test.groovy')], [('JSA001', 2)])
        self.assertNotIn("demo", str(analyze(source, "test.groovy")))

    def test_disabled_rule(self):
        self.assertEqual(analyze('println(1)', 'x.groovy', {'JSA003'}), [])

    def test_suppression_previous_line(self):
        s = '// jsa-ignore JSA003\nprintln("ignored")\nprintln("visible")'
        self.assertEqual([f.line for f in analyze(s, 'x.groovy')], [3])

    def test_inline_suppression(self):
        s = 'println("ignored") // jsa-ignore JSA003\nprintln("visible")'
        self.assertEqual([f.line for f in analyze(s, 'x.groovy')], [2])

    def test_new_rules(self):
        s = 'try {} catch (Exception e) {}\nnew ProcessBuilder("ls")\nlog.debug("hi")'
        self.assertEqual([f.rule for f in analyze(s, 'x.groovy')], ['JSA008', 'JSA009', 'JSA010'])

    def test_clean_script(self):
        self.assertEqual(analyze('log.info("hello")', 'clean.groovy'), [])


class ScanTests(unittest.TestCase):
    def test_scan_skips_ignored_directories(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'a.groovy').write_text('println(1)', encoding='utf-8')
            (root / '.git').mkdir()
            (root / '.git' / 'ignore.groovy').write_text('println(1)', encoding='utf-8')
            report = scan(root)
            self.assertEqual(report['files_scanned'], 1)
            self.assertEqual(report['counts']['LOW'], 1)
            self.assertEqual(report['findings'][0]['file'], 'a.groovy')

    def test_html_escapes_filename(self):
        report = {'files_scanned': 1, 'findings': [{'file': '<img src=x>', 'line': 1,
                 'column': 1, 'rule': 'JSA003', 'severity': 'LOW', 'message': 'demo'}]}
        page = render_html(report)
        self.assertIn('&lt;img src=x&gt;', page)
        self.assertNotIn('<img src=x>', page)

    def test_cli_outputs_and_threshold(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            script = root / 'demo.groovy'
            script.write_text('Thread.sleep(2)\nprintln("ok")', encoding='utf-8')
            report = root / 'report.json'
            self.assertEqual(main([str(script), '--output', str(report), '--fail-on', 'medium']), 1)
            self.assertEqual(len(json.loads(report.read_text())['findings']), 2)
            page = root / 'report.html'
            self.assertEqual(main([str(script), '--format', 'html', '--output', str(page)]), 0)
            self.assertIn('<table>', page.read_text())

    def test_csv_and_sarif(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            script = root / 'demo.groovy'
            script.write_text('println("ok")', encoding='utf-8')
            report = scan(script)
            self.assertIn('JSA003', to_csv(report))
            self.assertEqual(to_sarif(report)['version'], '2.1.0')
            self.assertEqual(to_sarif(report)['runs'][0]['results'][0]['ruleId'], 'JSA003')
            csv_file = root / 'report.csv'
            sarif_file = root / 'report.sarif'
            self.assertEqual(main([str(script), '--format', 'csv', '--output', str(csv_file)]), 0)
            self.assertEqual(main([str(script), '--format', 'sarif', '--output', str(sarif_file)]), 0)
            self.assertEqual(json.loads(sarif_file.read_text())['version'], '2.1.0')

    def test_csv_formula_neutralization(self):
        report = {'findings': [{'file': '=HYPERLINK("test")', 'line': 1,
                   'column': 1, 'rule': 'JSA003', 'severity': 'LOW', 'message': 'demo'}]}
        self.assertIn("'=HYPERLINK", to_csv(report))

    def test_missing_path(self):
        self.assertEqual(main(['this-file-does-not-exist.groovy']), 2)

    def test_documented_rules(self):
        self.assertEqual(VERSION, '0.4.0')
        self.assertEqual(len(RULES), 10)


if __name__ == '__main__':
    unittest.main()
