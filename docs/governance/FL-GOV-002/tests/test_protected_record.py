import sys
sys.dont_write_bytecode = True
import unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
import protected_record as schema

class ProtectedRecordTests(unittest.TestCase):
    def sample(self):
        return dict(path='synthetic/document.md', state='synthetic-only',
                    observed_at='2026-09-30T00:00:00Z', impact='synthetic review scope')

    def test_accept_exact_four(self):
        record = self.sample()
        self.assertEqual(schema.validate_record(record), record)
        self.assertEqual(set(schema.validate_record(record)), set(schema.FIELDS))

    def test_reject_each_extra(self):
        for field in ('st_mode', 'st_uid', 'st_gid', 'st_size', 'st_mtime_ns',
                      'st_ctime_ns', 'st_ino', 'st_atime', 'xattrs', 'unexpected'):
            with self.subTest(field=field), self.assertRaises(schema.RecordError):
                schema.validate_record({**self.sample(), field: 'SYNTHETIC'})

    def test_reject_each_missing(self):
        for field in schema.FIELDS:
            record = self.sample(); del record[field]
            with self.subTest(field=field), self.assertRaises(schema.RecordError):
                schema.validate_record(record)

    def test_reject_nested_or_empty_values(self):
        for value in ({'hidden': 'SYNTHETIC'}, [], None, 7, '', ' '):
            with self.subTest(value_type=type(value).__name__), self.assertRaises(schema.RecordError):
                schema.validate_record({**self.sample(), 'impact': value})

    def test_batch_fail_closed(self):
        with patch.object(schema.json, 'dumps') as output:
            with self.assertRaises(schema.RecordError):
                schema.encode_records([self.sample(), {**self.sample(), 'extra': 'SYNTHETIC'}])
            output.assert_not_called()

    def test_no_mutation(self):
        record = self.sample(); before = dict(record)
        validated = schema.validate_record(record); validated['path'] = 'synthetic/changed.md'
        self.assertEqual(record, before)

    def test_no_filesystem_access(self):
        with patch('builtins.open', side_effect=AssertionError('filesystem forbidden')), \
             patch('os.stat', side_effect=AssertionError('metadata forbidden')), \
             patch('os.lstat', side_effect=AssertionError('metadata forbidden')):
            self.assertIn('synthetic/document.md', schema.encode_records([self.sample()]))

    def test_safe_errors(self):
        with self.assertRaises(schema.RecordError) as result:
            schema.validate_record({**self.sample(), 'SYNTHETIC_PRIVATE_FIELD': 'SYNTHETIC_PRIVATE_VALUE'})
        self.assertEqual(str(result.exception), 'protected_record_fields_invalid')

if __name__ == '__main__':
    unittest.main()
