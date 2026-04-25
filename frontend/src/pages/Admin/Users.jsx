import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api/axios';
import { PageHeader, Filterbar, Panel, Tag, LoadingState, Empty } from '../../garago/Shell';
import Icon from '../../garago/Icon';
import { useAlertStore } from '../../store/alertStore';

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
};

const validatePwd = (pwd) => {
    const errs = [];
    if (pwd.length < 8) errs.push('At least 8 characters');
    if (!/[A-Z]/.test(pwd)) errs.push('Uppercase letter');
    if (!/[a-z]/.test(pwd)) errs.push('Lowercase letter');
    if (!/\d/.test(pwd)) errs.push('A digit');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) errs.push('A special character');
    return errs;
};

const Users = () => {
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
                if (!cancelled) addAlert?.({ type: 'ERROR', message: 'Failed to fetch users.' });
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
        });
        setFormErrors([]);
        setEditorOpen(true);
    };

    const submit = async (e) => {
        e.preventDefault();
        const errs = [];
        if (!editing && !form.password) errs.push('Password is required');
        if (!editing && form.password) errs.push(...validatePwd(form.password));
        if (editing && form.password) errs.push(...validatePwd(form.password));
        if (form.phone_number && (form.phone_number.length < 7 || form.phone_number.length > 15)) {
            errs.push('Phone must be 7–15 digits');
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
                    phone: fullPhone,
                };
                if (form.password) payload.password = form.password;
                await api.put(`/admin/users/${editing.id}`, payload);
                addAlert?.({ type: 'OK', message: 'User updated.' });
            } else if (form.role === 'DRIVER') {
                await api.post('/admin/users/driver', {
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
                addAlert?.({ type: 'OK', message: 'Driver account created.' });
            } else {
                await api.post('/admin/users', {
                    email: form.email,
                    password: form.password,
                    full_name: form.full_name,
                    role: form.role,
                    phone: fullPhone,
                });
                addAlert?.({ type: 'OK', message: 'User created.' });
            }
            setEditorOpen(false);
            await fetchUsers();
        } catch (err) {
            const detail = err?.response?.data?.detail;
            setFormErrors(
                Array.isArray(detail) ? detail.map((x) => `${(x.loc || []).join('.')} — ${x.msg}`) : [detail || 'Save failed.']
            );
        } finally {
            setSubmitting(false);
        }
    };

    const doDelete = async (id) => {
        if (!window.confirm('Deactivate this user?')) return;
        try {
            await api.delete(`/admin/users/${id}`);
            addAlert?.({ type: 'OK', message: 'User deactivated.' });
            fetchUsers();
        } catch (err) {
            addAlert?.({ type: 'ERROR', message: err?.response?.data?.detail || 'Action failed.' });
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
                title="Users"
                sub={`${users.length} users total`}
                actions={(
                    <button className="btn primary" onClick={openCreate}>
                        <Icon name="plus" />Add user
                    </button>
                )}
            />
            <Filterbar>
                <div className="field" style={{ minWidth: 260 }}>
                    <Icon name="search" />
                    <input
                        placeholder="Search by name, email, phone"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                    />
                </div>
                <div className="field">
                    <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                        <option value="ALL">All roles</option>
                        <option value="ADMIN">Admin</option>
                        <option value="MANAGER">Manager</option>
                        <option value="DRIVER">Driver</option>
                    </select>
                </div>
                <div className="sep" />
                <span className="mono text-xs muted">{filtered.length} results</span>
            </Filterbar>

            <div className="main-body">
                <Panel flush>
                    {loading ? (
                        <LoadingState />
                    ) : filtered.length === 0 ? (
                        <div style={{ padding: 28 }}><Empty>No users match.</Empty></div>
                    ) : (
                        <table className="tbl">
                            <thead>
                                <tr>
                                    <th style={{ width: 60 }}>ID</th>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Role</th>
                                    <th>Phone</th>
                                    <th>Status</th>
                                    <th style={{ width: 160 }}>Actions</th>
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
                                                <button className="btn ghost" onClick={() => openEdit(u)}>Edit</button>
                                                <button
                                                    className="btn"
                                                    style={{ color: 'var(--crit)' }}
                                                    onClick={() => doDelete(u.id)}
                                                >
                                                    Deactivate
                                                </button>
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
                            <strong>{editing ? 'Edit user' : 'Add user'}</strong>
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
                                    <label>Email</label>
                                    <div className="field">
                                        <input
                                            type="email"
                                            value={form.email}
                                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                                            disabled={!!editing}
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label>{editing ? 'New password (optional)' : 'Password'}</label>
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
                                <label>Full name</label>
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
                                    <label>Role</label>
                                    <div className="field">
                                        <select
                                            value={form.role}
                                            onChange={(e) => setForm({ ...form, role: e.target.value })}
                                            disabled={!!editing}
                                        >
                                            <option value="ADMIN">Admin</option>
                                            <option value="MANAGER">Manager</option>
                                            <option value="DRIVER">Driver</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label>Phone</label>
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

                            {!editing && form.role === 'DRIVER' ? (
                                <>
                                    <div className="rule" />
                                    <div
                                        className="mono text-xs muted"
                                        style={{ letterSpacing: '.06em', textTransform: 'uppercase' }}
                                    >
                                        Driver details
                                    </div>
                                    <div>
                                        <label>License number</label>
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
                                            <label>License expiry</label>
                                            <div className="field">
                                                <input
                                                    type="date"
                                                    value={form.license_expiry}
                                                    onChange={(e) => setForm({ ...form, license_expiry: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label>Garage ID</label>
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
                            <button type="button" className="btn" onClick={() => setEditorOpen(false)}>Cancel</button>
                            <button type="submit" className="btn primary" disabled={submitting}>
                                {submitting ? 'Saving…' : editing ? 'Save changes' : 'Create'}
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
