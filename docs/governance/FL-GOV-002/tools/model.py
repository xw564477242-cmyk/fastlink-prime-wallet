"""Pure governance model: no I/O, no execution or baseline mutation."""
STATES = ('VERIFIED', 'PENDING', 'STALE', 'PERMANENT-DEVIATION', 'HISTORY-GAP')
REQUIRED = ('DEV1-T03', 'DEV1-T12', 'EARLY-HISTORY', 'EVIDENCE-RETENTION')
EDGES = {
    'rls_functions': ['tenant_isolation'],
    'tenant_isolation': ['authenticated_api', 'tenant_admin'],
    'authenticated_api': ['wallet_reads', 'admin_views'],
    'api_contract': ['wallet_consumers', 'admin_consumers', 'provider_adapters'],
    'toolchain_lock': ['reproducible_build'],
    'reproducible_build': ['frontend_startup', 'backend_startup'],
    'identity_keys': ['authentication', 'signature_validation'],
    'authentication': ['tenant_isolation'],
    'funds_state': ['ledger_consistency'],
    'ledger_consistency': ['payments_settlement', 'wallet_balance'],
    'branch_base': ['provenance', 'promotion_proof'],
    'environment_config': ['local_isolation', 'service_health'],
    'governance_digest': ['baseline_loading'],
    'local_baseline_overlay': ['local_summary_reuse', 'local_history_reuse'],
    'baseline_loading': ['work_order_inheritance'],
}

def propagate(changed):
    """Only declared dependency edges; unknown inputs produce no invented scope."""
    reached = set(changed)
    todo = list(changed)
    while todo:
        for child in EDGES.get(todo.pop(), []):
            if child not in reached:
                reached.add(child)
                todo.append(child)
    return [{'conclusion': n, 'suggested_status': 'STALE',
             'next_action': '定向复验建议；须另经工单授权，不自动执行'}
            for n in sorted(reached - set(changed))]

def transition(record, event, *, gate_approved=False, evidence_complete=False):
    out = dict(record)
    out['constraints'] = list(record.get('constraints', REQUIRED))
    if set(out['constraints']) != set(REQUIRED):
        raise ValueError('unknown constraint')
    if event == 'produced':
        out['execution_phase'] = 'produced'
        out['status'] = 'PENDING'
    elif event == 'inputs_changed':
        if out.get('status') is not None:
            out['status'] = 'STALE'
    elif event == 'accepted':
        if out.get('status') not in ('PENDING', 'STALE'):
            raise ValueError('no produced result to accept')
        if not (gate_approved and evidence_complete):
            raise ValueError('acceptance and evidence required')
        out['status'] = 'VERIFIED'
    else:
        raise ValueError('unsupported transition')
    return out

def reusable(record, *, inputs_match, scope_matches, evidence_available, overdue_exception=False):
    return (record.get('status') == 'VERIFIED' and set(record.get('constraints', [])) == set(REQUIRED) and inputs_match and scope_matches
            and evidence_available and not overdue_exception)

def exception_state(item, now):
    """Inputs are timezone-aware datetimes. Return decisions, never perform actions."""
    required = ['reason', 'scope', 'approver', 'approved_at', 'expires_at',
                'risk', 'rollback', 'followup_ticket', 'persistent', 'red_lines']
    if any(k not in item for k in required) or any(not item[k] for k in required[:8]):
        return 'INVALID'
    if item['red_lines']:
        return 'FORBIDDEN'
    approved = item['approved_at']; expires = item['expires_at']
    if approved.tzinfo is None or expires.tzinfo is None or now.tzinfo is None:
        return 'INVALID'
    if approved > now or expires <= approved:
        return 'INVALID'
    if item['persistent']:
        effective = item.get('effective_at')
        if effective is None or effective.tzinfo is None or effective > now:
            return 'INVALID'
        if (expires-min(approved,effective)).total_seconds() > 48*3600:
            return 'INVALID'
    if now >= expires:
        if item['persistent']: return 'OVERDUE-GATES'
        return 'EXPIRED-ARCHIVE-PROPOSAL' if item.get('no_persistent_effect_confirmed') else 'EXPIRED-REVIEW-REQUIRED'
    return 'ACTIVE'

def validate_template(text):
    required = list(REQUIRED) + ['PERMANENT-DEVIATION', 'HISTORY-GAP', 'PENDING',
                                '基线版本', '合并SHA', '复用', '增量']
    return [word for word in required if word not in text]
