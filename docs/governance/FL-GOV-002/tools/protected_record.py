"""Strict protected-evidence boundary. Pure data validation; no filesystem access."""
import json

FIELDS = ('path', 'state', 'observed_at', 'impact')

class RecordError(ValueError):
    """Only fixed messages; never include supplied field names or values."""

def validate_record(record):
    # Reject the whole input; never silently discard unauthorized fields.
    if type(record) is not dict or set(record) != set(FIELDS):
        raise RecordError('protected_record_fields_invalid')
    if any(type(record[key]) is not str or not record[key].strip() for key in FIELDS):
        raise RecordError('protected_record_values_invalid')
    return {key: record[key] for key in FIELDS}

def encode_records(records):
    """Validate the entire batch before producing any serialized output."""
    if type(records) is not list:
        raise RecordError('protected_record_batch_invalid')
    validated = [validate_record(record) for record in records]
    return json.dumps(validated, ensure_ascii=False, indent=2) + '\n'
