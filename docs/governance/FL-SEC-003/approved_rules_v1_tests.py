"""Only synthetic boolean structure records; no supplied literal examples."""
from approved_rules_v1 import evaluate_structure
from copy import deepcopy

def run_tests():
    tests=[]
    def check(name, passed):tests.append({'name':name,'status':'PASS' if passed else 'FAIL'})
    common={'approved_structure_bound':True,'all_occurrences_checked':True,'nonsecret_semantics_proven':True,'non_authenticating_use_proven':True,'reference_bindings_verified':True,'explicit_secret_shape':False,'context_conflict':False}
    structures={
      'placeholder':{'placeholder_marker':True,'template_parser_verified':True,'no_valid_credential_format':True},
      'test-generated':{'dynamic_test_generation':True,'test_provenance_verified':True,'excluded_from_live_authentication':True},
      'public-integrity':{'public_checksum_semantics':True,'complete_digest_parser_verified':True,'key_attributes_absent':True},
      'documented-example':{'documentation_example_marker':True,'example_provenance_verified':True,'excluded_from_live_authentication':True}}
    for family, flags in structures.items():
        full=dict(common,**flags);before=deepcopy(full);r=evaluate_structure(full)
        check(family+'_with_synthetic_complete_evidence',r['rule']==family and r['apply'] is False)
        check(family+'_structure_alone_falls_back',evaluate_structure(flags)['rule']=='UNKNOWN')
        check(family+'_input_unchanged',full==before)
        for key in ('approved_structure_bound','all_occurrences_checked','nonsecret_semantics_proven','non_authenticating_use_proven','reference_bindings_verified'):
            check(family+'_missing_'+key,evaluate_structure(dict(full,**{key:None}))['rule']=='UNKNOWN')
    good=dict(common,**structures['placeholder'])
    for shape in ('token','jwt','credential-url','secret-assignment','authorization','private-key'):
        r=evaluate_structure(dict(good,explicit_secret_shape=True,secret_shape_type=shape,source_layer='archive'))
        check('negative_'+shape,r['rule']=='UNKNOWN' and not r['apply'])
    check('conflict_falls_back',evaluate_structure(dict(good,context_conflict=True))['rule']=='UNKNOWN')
    check('unknown_conflict_falls_back',evaluate_structure(dict(good,context_conflict=None))['rule']=='UNKNOWN')
    check('multiple_rules_fall_back',evaluate_structure(dict(good,**structures['public-integrity']))['rule']=='UNKNOWN')
    for family in structures:
        check('path_alone_'+family,evaluate_structure({'directory':'synthetic','filename':family})['rule']=='UNKNOWN')
    check('test_prefix_alone',evaluate_structure(dict(common,test_prefix=True))['rule']=='UNKNOWN')
    check('fixed_magic_alone',evaluate_structure(dict(common,fixed_magic_marker=True))['rule']=='UNKNOWN')
    check('incomplete_digest',evaluate_structure(dict(common,public_checksum_semantics=True,complete_digest_parser_verified=False,key_attributes_absent=True))['rule']=='UNKNOWN')
    check('invalid_input',evaluate_structure(None)['rule']=='UNKNOWN')
    check('human_review_required',evaluate_structure(good)['human_review_required'] is True)
    check('deterministic',all(evaluate_structure(good)==evaluate_structure(good) for _ in range(20)))
    return {'tests':tests,'passed':sum(t['status']=='PASS' for t in tests),'failed':sum(t['status']=='FAIL' for t in tests),'fixture_kind':'synthetic-boolean-structures','literal_user_examples_copied':False,'supplemental_evidence_in_positive_controls':'synthetic only; not a claim about real candidates'}
