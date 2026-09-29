"""All fixtures are structural booleans/labels, not credentials or production samples."""
from rules import evaluate, p0_trigger
import json

def run_tests():
    results=[]
    def check(name,ok):results.append({'name':name,'status':'PASS' if ok else 'FAIL'})
    base={'sample_id':'SYNTH-01','secret_use':False,'all_occurrences_covered':True,'context_conflict':False,
          'field_semantics':'public-integrity','algorithm':'sha256','decoded_bytes':32,'parser_verified':True,'reference_binding_verified':True}
    def approval(rule='R10-integrity',expected='结构化非秘密'):
        return {'SYNTH-01':{'sample_id':'SYNTH-01','expected_classification':expected,'applicable_rules':[rule],
               'nonsecret_confirmed':True,'approver_role':'SYNTHETIC-TEST-ROLE','approved_at':'synthetic-test-time','kind':'synthetic-fixture'}}
    a=approval();good=evaluate(base,a,'synthetic');check('integrity_positive',good['rule']=='R10-integrity')
    for k,v in [('secret_use',True),('secret_use',None),('all_occurrences_covered',False),('context_conflict',True),('decoded_bytes',31),('algorithm','unknown'),('parser_verified',False),('reference_binding_verified',False)]:
        check('reject_'+k+'_'+str(v),evaluate(dict(base,**{k:v}),a,'synthetic')['proposal']=='仍无法确认')
    check('approval_missing',evaluate(base,{},'synthetic')['proposal']=='仍无法确认')
    check('synthetic_not_real_approval',evaluate(base,a,'dry-run')['proposal']=='仍无法确认')
    for k in ['approver_role','approved_at','nonsecret_confirmed','expected_classification','applicable_rules']:
        q=approval();q['SYNTH-01'].pop(k);check('incomplete_approval_'+k,evaluate(base,q,'synthetic')['proposal']=='仍无法确认')
    pub={'sample_id':'SYNTH-01','secret_use':False,'all_occurrences_covered':True,'context_conflict':False,'public_structure':'certificate','parser_verified':True,'private_material_absent':True,'reference_binding_verified':True}
    check('public_structure_positive',evaluate(pub,approval('R20-public-structure'),'synthetic')['rule']=='R20-public-structure')
    check('private_marker_blocks',evaluate(dict(pub,private_material_absent=False),approval('R20-public-structure'),'synthetic')['proposal']=='仍无法确认')
    ident={'sample_id':'SYNTH-01','secret_use':False,'all_occurrences_covered':True,'context_conflict':False,'declaration_verified':True,'reference_graph_complete':True,'all_uses_nonsecret':True}
    check('identifier_positive',evaluate(ident,approval('R30-identifier'),'synthetic')['rule']=='R30-identifier')
    check('identifier_partial_blocks',evaluate(dict(ident,reference_graph_complete=False),approval('R30-identifier'),'synthetic')['proposal']=='仍无法确认')
    ex={'sample_id':'SYNTH-01','secret_use':False,'all_occurrences_covered':True,'context_conflict':False,'non_authenticating_fixture_provenance':True,'owner_nonlive_confirmation':True,'runtime_exclusion_verified':True}
    check('example_positive',evaluate(ex,approval('R40-example','示例/测试'),'synthetic')['rule']=='R40-example')
    check('example_runtime_unknown_blocks',evaluate(dict(ex,runtime_exclusion_verified=False),approval('R40-example','示例/测试'),'synthetic')['proposal']=='仍无法确认')
    clash=dict(base,**ident);q=approval();q['SYNTH-01']['applicable_rules']+=['R30-identifier'];check('multiple_rules_fallback',evaluate(clash,q,'synthetic')['proposal']=='仍无法确认')
    check('stable_result',all(evaluate(base,a,'synthetic')==good for _ in range(100)))
    for directory in ['vendor','cache','first-party','production']:
        check('no_directory_whitelist_'+directory,evaluate({'directory':directory,'filename':'example','repository':'example'},a,'synthetic')['proposal']=='仍无法确认')
        check('directory_cannot_override_'+directory,evaluate(dict(base,directory=directory),a,'synthetic')==good)
    before=json.dumps([base,a],sort_keys=True);evaluate(base,a,'synthetic');check('input_not_mutated',before==json.dumps([base,a],sort_keys=True))
    check('never_applies',all(evaluate(x,a,'synthetic')['apply'] is False for x in [base,pub,ident,ex,{}]))
    check('human_review_always',all(evaluate(x,a,'synthetic')['human_review_required'] for x in [base,pub,ident,ex,{}]))
    check('invalid_mode_fallback',evaluate(base,a,'apply')['proposal']=='仍无法确认')
    q=approval();q['SYNTH-01']['sample_id']='SYNTH-OTHER';check('sample_binding_mismatch',evaluate(base,q,'synthetic')['proposal']=='仍无法确认')
    flags=('production_credential_confirmed','production_runtime_path_confirmed','active_external_service_confirmed','funds_or_core_privilege_confirmed')
    review={'owner_confirmed':True,'reviewer_role':'SYNTHETIC-TEST-ROLE','reviewed_at':'synthetic-test-time','nonsecret_basis':'SYNTHETIC-STRUCTURAL-BASIS',**{k:False for k in flags}}
    for flag in flags:check('p0_'+flag,p0_trigger(dict(review,**{flag:True}))=={'decision':'另开独立P0处置工单','execute':False})
    check('p0_no_owner_confirmation',p0_trigger(dict(review,owner_confirmed=False))['decision']=='待确认')
    check('p0_no_input',p0_trigger({})=={'decision':'待确认','execute':False})
    check('p0_no_trigger_requires_review',p0_trigger(review)['decision']=='所提供记录未触发P0条件，安全负责人复核')
    check('unapproved_second_structure_still_blocks',evaluate(clash,approval(),'synthetic')['proposal']=='仍无法确认')
    check('invalid_feature_type',evaluate(None,a,'synthetic')['proposal']=='仍无法确认')
    check('invalid_approval_record',evaluate(base,{'SYNTH-01':[]},'synthetic')['proposal']=='仍无法确认')
    q=approval();q['SYNTH-01']['applicable_rules']='R10-integrity';check('invalid_rule_binding_type',evaluate(base,q,'synthetic')['proposal']=='仍无法确认')
    check('invalid_p0_record',p0_trigger(None)=={'decision':'待确认','execute':False})
    return {'fixture_kind' :'synthetic-structural-only','external_sample_validation_completed':False,'tests':results,'passed':sum(x['status']=='PASS' for x in results),'failed':sum(x['status']=='FAIL' for x in results)}
if __name__=='__main__': print(json.dumps(run_tests(),ensure_ascii=False))
