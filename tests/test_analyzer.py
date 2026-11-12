import unittest
from analyzer import analyze


class AnalyzerTests(unittest.TestCase):
    def test_finds_credential_and_print(self):
        result = analyze('def apiToken = "example-value"\nprintln("hello")', 'sample.groovy')
        self.assertEqual([r['rule'] for r in result], ['JSA001', 'JSA003'])
        self.assertEqual([r['line'] for r in result], [1, 2])

    def test_clean_file(self):
        self.assertEqual(analyze('log.info("hello")', 'clean.groovy'), [])


if __name__ == '__main__':
    unittest.main()
