"""FL-SEC-003 v0.1.0: pure proposal engine; never applies labels or severities."""
VERSION = '0.1.0-phase-A'
CANDIDATES = ('R10-integrity', 'R20-public-structure', 'R30-identifier', 'R40-example')
def evaluate(features, approvals, mode='dry-run'):
    unknown = {'rule':'R00-unknown','proposal':'仍无法确认','human_review_required':True,'apply':False}
    if not isinstance(features,dict) or not isinstance(approvals,dict): return dict(unknown,reason='invalid-metadata-type')
    if mode not in ('dry-run','synthetic'): return dict(unknown,reason='unsupported-mode')
    if features.get('secret_use') is not False: return dict(unknown,reason='secret-use-unknown-or-present')
    if features.get('all_occurrences_covered') is not True: return dict(unknown,reason='incomplete-occurrence-context')
    if features.get('context_conflict') is not False: return dict(unknown,reason='conflict-or-unknown')
    sample = approvals.get(features.get('sample_id'))
    if not isinstance(sample,dict) or not sample: return dict(unknown,reason='approved-sample-missing')
    required = ('sample_id','expected_classification','applicable_rules','nonsecret_confirmed','approver_role','approved_at','kind')
    if any(k not in sample for k in required) or sample['nonsecret_confirmed'] is not True or not sample['approver_role'] or not sample['approved_at']:
        return dict(unknown,reason='approval-incomplete')
    if not isinstance(sample['applicable_rules'],list) or not sample['applicable_rules'] or any(r not in CANDIDATES for r in sample['applicable_rules']): return dict(unknown,reason='invalid-rule-binding')
    if sample['sample_id'] != features.get('sample_id'): return dict(unknown,reason='sample-binding-mismatch')
    if mode == 'dry-run' and sample['kind'] != 'approved-external': return dict(unknown,reason='synthetic-is-not-external-approval')
    if mode == 'synthetic' and sample['kind'] != 'synthetic-fixture': return dict(unknown,reason='fixture-kind-mismatch')
    matches = []
    lengths = {'sha256':32,'sha384':48,'sha512':64}
    if (features.get('field_semantics') == 'public-integrity' and features.get('algorithm') in lengths
        and features.get('decoded_bytes') == lengths[features['algorithm']] and features.get('parser_verified') is True
        and features.get('reference_binding_verified') is True): matches.append(('R10-integrity','结构化非秘密'))
    if (features.get('public_structure') in ('public-key','certificate','public-signature') and features.get('parser_verified') is True
        and features.get('private_material_absent') is True and features.get('reference_binding_verified') is True): matches.append(('R20-public-structure','结构化非秘密'))
    if (features.get('declaration_verified') is True and features.get('reference_graph_complete') is True
        and features.get('all_uses_nonsecret') is True): matches.append(('R30-identifier','结构化非秘密'))
    if (features.get('non_authenticating_fixture_provenance') is True and features.get('owner_nonlive_confirmation') is True
        and features.get('runtime_exclusion_verified') is True): matches.append(('R40-example','示例/测试'))
    if len(matches) > 1: return dict(unknown,reason='conflicting-structures')
    matches = [x for x in matches if x[0] in sample['applicable_rules'] and x[1] == sample['expected_classification']]
    if len(matches) != 1: return dict(unknown,reason='ambiguous-or-unmatched-structure')
    return {'rule':matches[0][0],'proposal':matches[0][1],'human_review_required':True,'apply':False,'reason':'proposal-only-with-bound-approved-evidence'}

def p0_trigger(review):
    """Disposition proposal only; never authenticates or executes an action."""
    if not isinstance(review,dict): return {'decision':'待确认','execute':False}
    required=('owner_confirmed','reviewer_role','reviewed_at','nonsecret_basis')
    if any(k not in review for k in required) or review['owner_confirmed'] is not True or not all(review[k] for k in required[1:]):
        return {'decision':'待确认','execute':False}
    flags=('production_credential_confirmed','production_runtime_path_confirmed','active_external_service_confirmed','funds_or_core_privilege_confirmed')
    if any(review.get(k) is True for k in flags):return {'decision':'另开独立P0处置工单','execute':False}
    if not all(review.get(k) is False for k in flags):return {'decision':'待确认','execute':False}
    return {'decision':'所提供记录未触发P0条件，安全负责人复核','execute':False}
