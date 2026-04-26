import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { PageHeader, Filterbar, Panel, Tag, LoadingState, Empty } from '../../garago/Shell';
import Icon from '../../garago/Icon';
import { useAlertStore } from '../../store/alertStore';
import { useTranslation } from '../../hooks/useTranslation';

const emptyForm = {
    email: '',
    password: '',
    full_name: '',
    role: 'DRIVER',
    phone_code: '+20',
    phone_number: '',
    license_number: '',
    license_expiry: '',
    garage_id: '',
    is_active: true,
    preferred_language: 'en',
};

const validatePwd = (pwd, t) => {
    const errs = [];
    if (pwd.length < 8) errs.push(t('users.passwordMin'));
    if (!/[A-Z]/.test(pwd)) errs.push(t('users.passwordUpper'));
    if (!/[a-z]/.test(pwd)) errs.push(t('users.passwordLower'));
    if (!/\d/.test(pwd)) errs.push(t('users.passwordDigit'));
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) errs.push(t('users.passwordSpecial'));
    return errs;
};

const Users = () => {
    const { t } = useTranslation();
    const addAlert = useAlertStore((s) => s.addAlert);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState('ALL');
    const [editorOpen, setEditorOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(emptyForm);
    const [submitting, setSubmitting] = useState(false);
    const [formErrors, setFormErrors] = useState([]);

    const fetchUsers = useCallback(async () => {
        const res = await api.get('/admin/users');
        setUsers(res.data || []);
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const res = await api.get('/admin/users');
                if (!cancelled) setUsers(res.data || []);
            } catch {
                if (!cancelled) addAlert?.({ type: 'ERROR', message: t('users.errorFetching') });
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [addAlert]);

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setFormErrors([]);
        setEditorOpen(true);
    };

    const openEdit = (u) => {
        let pCode = '+20';
        let pNum = u.phone || '';
        if (pNum.startsWith('+')) {
            const match = pNum.match(/^(\+\d{1,4})(\d+)$/);
            if (match) {
                pCode = match[1];
                pNum = match[2];
            }
        }
        setEditing(u);
        setForm({
            ...emptyForm,
            email: u.email || '',
            full_name: u.full_name || '',
            role: u.role || 'DRIVER',
            phone_code: pCode,
            phone_number: pNum,
            is_active: u.is_active !== false,
            preferred_language: u.preferred_language || 'en',
        });
        setFormErrors([]);
        setEditorOpen(true);
    };

    const submit = async (e) => {
        e.preventDefault();
        const errs = [];
        if (!editing && !form.password) errs.push(t('users.passwordReq'));
        if (!editing && form.password) errs.push(...validatePwd(form.password, t));
        if (editing && form.password) errs.push(...validatePwd(form.password, t));
        if (form.phone_number && (form.phone_number.length < 7 || form.phone_number.length > 15)) {
            errs.push(t('users.phoneInvalid'));
        }
        if (errs.length) {
            setFormErrors(errs);
            return;
        }
        setFormErrors([]);
        setSubmitting(true);
        const fullPhone = `${form.phone_code}${form.phone_number}`;
        try {
            if (editing) {
                const payload = {
                    email: form.email,
                    full_name: form.full_name,
                    role: form.role,
                    phone: form.phone_number ? fullPhone : null,
                    preferred_language: form.preferred_language,
                    is_active: form.is_active,
                };
                if (form.password) payload.password = form.password;
                await api.put(`/admin/users/${editing.id}`, payload);
                addAlert?.({ type: 'OK', message: t('users.userUpdatedShort') });
            } else if (form.role === 'DRIVER') {
                await api.post('/admin/users/with-driver', {
                    user: {
                        email: form.email,
                        password: form.password,
                        full_name: form.full_name,
                        role: 'DRIVER',
                        phone: fullPhone,
                        is_active: true,
                    },
                    driver: {
                        license_number: form.license_number,
                        license_expiry: form.license_expiry || null,
                        garage_id: form.garage_id ? parseInt(form.garage_id, 10) : null,
                    },
                });
                addAlert?.({ type: 'OK', message: t('users.driverCreated') });
            } else {
                await api.post('/admin/users', {
                    email: form.email,
                    password: form.password,
                    full_name: form.full_name,
                    role: form.role,
                    phone: fullPhone,
                });
                addAlert?.({ type: 'OK', message: t('users.userCreatedShort') });
            }
            setEditorOpen(false);
            await fetchUsers();
        } catch (err) {
            const detail = err?.response?.data?.detail;
            setFormErrors(
                Array.isArray(detail) ? detail.map((x) => `${(x.loc || []).join('.')} — ${x.msg}`) : [detail || t('users.saveFailed')]
            );
        } finally {
            setSubmitting(false);
        }
    };

    const doDelete = async (id) => {
        if (!window.confirm(t('users.deactivateConfirm'))) return;
        try {
            await api.delete(`/admin/users/${id}`);
            addAlert?.({ type: 'OK', message: t('users.userDeactivatedShort') });
            fetchUsers();
        } catch (err) {
            addAlert?.({ type: 'ERROR', message: err?.response?.data?.detail || t('users.actionFailed') });
        }
    };

    const doActivate = async (id) => {
        if (!window.confirm(t('users.activateConfirm'))) return;
        try {
            await api.put(`/admin/users/${id}`, { is_active: true });
            addAlert?.({ type: 'OK', message: t('users.userActivated') });
            fetchUsers();
        } catch (err) {
            addAlert?.({ type: 'ERROR', message: err?.response?.data?.detail || t('users.actionFailed') });
        }
    };

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return users.filter((u) => {
            if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
            if (!q) return true;
            return (
                String(u.full_name || '').toLowerCase().includes(q) ||
                String(u.email || '').toLowerCase().includes(q) ||
                String(u.phone || '').toLowerCase().includes(q) ||
                String(u.id).includes(q)
            );
        });
    }, [users, query, roleFilter]);

    return (
        <>
            <PageHeader
                title={t('sidebar.users')}
                sub={t('users.totalUsers', { n: users.length })}
                actions={(
                    <button className="btn primary" onClick={openCreate}>
                        <Icon name="plus" />{t('users.addUserBtn')}
                    </button>
                )}
            />
            <Filterbar>
                <div className="field" style={{ minWidth: 260 }}>
                    <Icon name="search" />
                    <input
                        placeholder={t('users.searchPh')}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
                <div className="field">
                    <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                        <option value="ALL">{t('shell.allRoles')}</option>
                        <option value="ADMIN">{t('users.roleAdmin')}</option>
                        <option value="MANAGER">{t('users.roleManager')}</option>
                        <option value="DRIVER">{t('users.roleDriver')}</option>
                    </select>
                </div>
                <div className="sep" />
                <span className="mono text-xs muted">{filtered.length} {t('shell.results')}</span>
            </Filterbar>

            <div className="main-body">
                <Panel flush>
                    {loading ? (
                        <LoadingState />
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: 28 }}><Empty>{t('users.noUsersMatch')}</Empty></div>
                    ) : (
                        <table className="tbl">
                            <thead>
                                <tr>
                                    <th style={{ width: 60 }}>{t('common.id')}</th>
                                    <th>{t('users.fullName')}</th>
                                    <th>{t('users.email')}</th>
                                    <th>{t('users.role')}</th>
                                    <th>{t('users.phone')}</th>
                                    <th>{t('common.status')}</th>
                                    <th style={{ width: 160 }}>{t('shell.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((u) => (
                                    <tr key={u.id} style={{ opacity: u.is_active === false ? 0.55 : 1 }}>
                                        <td className="mono text-sm">{u.id}</td>
                                        <td>{u.full_name}</td>
                                        <td className="text-sm muted">{u.email}</td>
                                        <td><span className="mono text-xs">{u.role}</span></td>
                                        <td className="mono text-xs">{u.phone || '—'}</td>
                                        <td>{u.is_active ? <Tag status="ACTIVE" /> : <Tag status="INACTIVE" />}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button className="btn ghost" onClick={() => openEdit(u)}>{t('common.edit')}</button>
                                                {u.is_active === false ? (
                                                    <button
                                                        className="btn"
                                                        style={{ color: 'var(--ok)' }}
                                                        onClick={() => doActivate(u.id)}
                                                    >
                                                        {t('common.activate')}
                                                    </button>
                                                ) : (
                                                    <button
                                                        className="btn"
                                                        style={{ color: 'var(--crit)' }}
                                                        onClick={() => doDelete(u.id)}
                                                    >
                                                        {t('common.deactivate')}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Panel>
            </div>

            {editorOpen ? (
                <ModalOverlay onClose={() => setEditorOpen(false)}>
                    <form className="panel" onSubmit={submit} style={{ width: 520 }}>
                        <div className="panel-head">
                            <strong>{editing ? t('users.editUser') : t('users.addUser')}</strong>
                            <button type="button" className="btn ghost" onClick={() => setEditorOpen(false)}>
                                <Icon name="x" />
                            </button>
                        </div>
                        <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {formErrors.length ? (
                                <ul
                                    className="mono text-xs"
                                    style={{ color: 'var(--crit)', paddingInlineStart: 16, margin: 0 }}
                                >
                                    {formErrors.map((e, i) => <li key={i}>{e}</li>)}
                                </ul>
                            ) : null}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label>{t('users.email')}</label>
                                    <div className="field">
                                        <input
                                            type="email"
                                            value={form.email}
                                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label>{editing ? t('users.passwordKeep') : t('users.password')}</label>
                                    <div className="field">
                                        <input
                                            type="password"
                                            value={form.password}
                                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                                            required={!editing}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label>{t('users.fullName')}</label>
                                <div className="field">
                                    <input
                                        value={form.full_name}
                                        onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                <div>
                                    <label>{t('users.role')}</label>
                                    <div className="field">
                                        <select
                                            value={form.role}
                                            onChange={(e) => setForm({ ...form, role: e.target.value })}
                                        >
                                            <option value="ADMIN">{t('users.roleAdmin')}</option>
                                            <option value="MANAGER">{t('users.roleManager')}</option>
                                            <option value="DRIVER">{t('users.roleDriver')}</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label>{t('users.phone')}</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 6 }}>
                                        <div className="field">
                                            <select
                                                value={form.phone_code}
                                                onChange={(e) => setForm({ ...form, phone_code: e.target.value })}
                                            >
                                                <option value="+1">+1</option>
                                                <option value="+20">+20</option>
                                                <option value="+44">+44</option>
                                                <option value="+966">+966</option>
                                                <option value="+971">+971</option>
                                            </select>
                                        </div>
                                        <div className="field">
                                            <input
                                                inputMode="numeric"
                                                value={form.phone_number}
                                                onChange={(e) =>
                                                    setForm({ ...form, phone_number: e.target.value.replace(/\D/g, '') })
                                                }
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {editing ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                    <div>
                                        <label>{t('common.status')}</label>
                                        <div className="field">
                                            <select
                                                value={form.is_active ? 'true' : 'false'}
                                                onChange={(e) => setForm({ ...form, is_active: e.target.value === 'true' })}
                                            >
                                                <option value="true">{t('common.active')}</option>
                                                <option value="false">{t('common.inactive')}</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label>{t('users.preferredLang')}</label>
                                        <div className="field">
                                            <select
                                                value={form.preferred_language}
                                                onChange={(e) => setForm({ ...form, preferred_language: e.target.value })}
                                            >
                                                <option value="en">{t('settings.english')}</option>
                                                <option value="ar">{t('settings.arabic')}</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            {!editing && form.role === 'DRIVER' ? (
                                <>
                                    <div className="rule" />
                                    <div
                                        className="mono text-xs muted"
                                        style={{ letterSpacing: '.06em', textTransform: 'uppercase' }}
                                    >
                                        {t('users.driverDetails')}
                                    </div>
                                    <div>
                                        <label>{t('users.licenseNumber')}</label>
                                        <div className="field">
                                            <input
                                                value={form.license_number}
                                                onChange={(e) => setForm({ ...form, license_number: e.target.value })}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                                        <div>
                                            <label>{t('users.licenseExpiry')}</label>
                                            <div className="field">
                                                <input
                                                    type="date"
                                                    value={form.license_expiry}
                                                    onChange={(e) => setForm({ ...form, license_expiry: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label>{t('users.garageId')}</label>
                                            <div className="field">
                                                <input
                                                    type="number"
                                                    value={form.garage_id}
                                                    onChange={(e) => setForm({ ...form, garage_id: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </>
                            ) : null}
                        </div>
                        <div
                            style={{
                                display: 'flex',
                                gap: 8,
                                padding: 14,
                                borderTop: '1px solid var(--line)',
                                justifyContent: 'flex-end',
                            }}
                        >
                            <button type="button" className="btn" onClick={() => setEditorOpen(false)}>{t('common.cancel')}</button>
                            <button type="submit" className="btn primary" disabled={submitting}>
                                {submitting ? t('shell.saving') : editing ? t('common.save') : t('common.create')}
                            </button>
                        </div>
                    </form>
                </ModalOverlay>
            ) : null}
        </>
    );
};

const ModalOverlay = ({ children, onClose }) => (
    <div
        role="dialog"
        aria-modal="true"
        onClick={onClose}
        style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,.4)',
            backdropFilter: 'blur(6px)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 200,
        }}
    >
        <div onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
);

export default Users;
