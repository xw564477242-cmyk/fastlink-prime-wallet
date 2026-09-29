"""Approved structural policy: proposals only, no values, IO, or severity writes."""
VERSION = '1.0.0-R03'
FAMILIES = ('placeholder', 'test-generated', 'public-integrity', 'documented-example')
def evaluate_structure(features):
    base = {'rule': 'UNKNOWN', 'proposal': '仍无法确认', 'apply': False, 'human_review_required': True}
    if not isinstance(features, dict):
        return dict(base, reason='invalid-input')
    if features.get('explicit_secret_shape') is True:
        return dict(base, reason='explicit-secret-shape-preserve-grade')
    # Every flag requires evidence; a filename, prefix or approved sample is insufficient.
    required_true = ('approved_structure_bound', 'all_occurrences_checked', 'nonsecret_semantics_proven', 'non_authenticating_use_proven', 'reference_bindings_verified')
    if any(features.get(k) is not True for k in required_true):
        return dict(base, reason='insufficient-context-evidence')
    if features.get('explicit_secret_shape') is not False or features.get('context_conflict') is not False:
        return dict(base, reason='conflict-or-unknown')
    matches = []
    if features.get('placeholder_marker') is True and features.get('template_parser_verified') is True and features.get('no_valid_credential_format') is True:
        matches.append('placeholder')
    if features.get('dynamic_test_generation') is True and features.get('test_provenance_verified') is True and features.get('excluded_from_live_authentication') is True:
        matches.append('test-generated')
    if features.get('public_checksum_semantics') is True and features.get('complete_digest_parser_verified') is True and features.get('key_attributes_absent') is True:
        matches.append('public-integrity')
    if features.get('documentation_example_marker') is True and features.get('example_provenance_verified') is True and features.get('excluded_from_live_authentication') is True:
        matches.append('documented-example')
    if len(matches) != 1:
        return dict(base, reason='multiple-or-unmatched-structures')
    return dict(base, rule=matches[0], proposal='拟进入人工复核队列', reason='structure-and-supplemental-evidence-complete')
