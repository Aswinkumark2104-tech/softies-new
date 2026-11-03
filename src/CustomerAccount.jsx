import React, { useCallback, useEffect, useState } from 'react';
import { supabase, supabaseConfigured } from './supabase';
const money = n => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(n || 0));
const statuses = ['PAYMENT_PENDING', 'PLACED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
const shell = { fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: '#fff8f3', padding: 24, color: '#333247' };
const box = { background: '#fff', border: '1px solid #eee', borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: '0 8px 24px #382a3908' };
const input = { display: 'block', width: '100%', boxSizing: 'border-box', padding: 12, border: '1px solid #e7dfe8', borderRadius: 10, marginTop: 6, font: 'inherit' };

export default function CustomerAccount() {
  const [session, setSession] = useState(null), [email, setEmail] = useState(''), [password, setPassword] = useState(''), [mode, setMode] = useState('signin');
  const [orders, setOrders] = useState([]), [items, setItems] = useState({}), [updates, setUpdates] = useState({});
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [newPassword, setNewPassword] = useState('');
  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => subscription.unsubscribe();
  }, []);

  const loadOrders = useCallback(async () => {
    if (!session?.user || !supabaseConfigured) return;
    setBusy(true);
    const { data, error } = await supabase.from('orders').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false });
    if (error) setMessage(error.message);
    else {
      setOrders(data || []);
      const ids = (data || []).map(o => o.id);
      if (ids.length) {
        const [{ data: rows, error: rowError }, { data: timeline, error: timelineError }] = await Promise.all([
          supabase.from('order_items').select('*').in('order_id', ids),
          supabase.from('tracking_updates').select('*').in('order_id', ids).order('created_at', { ascending: false })
        ]);
        if (!rowError) { const grouped = {}; (rows || []).forEach(r => (grouped[r.order_id] ??= []).push(r)); setItems(grouped); }
        if (!timelineError) { const grouped = {}; (timeline || []).forEach(r => (grouped[r.order_id] ??= []).push(r)); setUpdates(grouped); }
      } else { setItems({}); setUpdates({}); }
    }
    setBusy(false);
  }, [session?.user?.id]);
  useEffect(() => { loadOrders(); }, [loadOrders]);

  const googleSignIn = async () => {
    if (!supabaseConfigured) return setMessage('Supabase is not connected.');
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/account` } });
    if (error) setMessage(error.message);
  };
  const auth = async e => {
    e.preventDefault();
    if (!supabaseConfigured) return setMessage('Supabase is not connected. Configure the environment variables first.');
    const result = mode === 'signin' ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password });
    if (result.error) setMessage(result.error.message);
    else if (mode === 'signup') setMessage('Account created. Check your email to confirm your account, then sign in.');
    else setSession(result.data.session);
  };
  const resetPassword = async () => {
    if (!email) return setMessage('Enter your email address first.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/account` });
    setMessage(error ? error.message : 'Password reset email requested. Check your inbox and spam folder.');
  };
  const changePassword = async e => {
    e.preventDefault();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) setMessage(error.message); else { window.history.replaceState({}, document.title, window.location.pathname); setNewPassword(''); setMessage('Password updated successfully.'); }
  };
  const signout = async () => { await supabase.auth.signOut(); setSession(null); setOrders([]); setItems({}); setUpdates({}); };
  const isRecovery = window.location.hash.includes('type=recovery');

  return <div style={shell}><div style={{ maxWidth: 1000, margin: '0 auto' }}>
    <a href="/" style={{ color: '#e8798e', fontWeight: 800, textDecoration: 'none' }}>← SOFTIES store</a>
    <h1>My account & order tracking</h1><p style={{ color: '#777' }}>Sign in with the same email you used at checkout to view your order history and delivery updates.</p>
    {!supabaseConfigured && <div style={box}>Supabase is not connected yet. Add the Supabase URL and public key to the Netlify environment variables.</div>}
    {isRecovery && session ? <form onSubmit={changePassword} style={{ ...box, maxWidth: 440 }}><h2>Choose a new password</h2><label>New password<input style={input} type="password" minLength="8" required value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label><button style={{ ...input, background: '#ff7896', color: '#fff', border: 0, fontWeight: 800 }}>Save new password</button>{message && <p role="status">{message}</p>}</form> : !session ? <form onSubmit={auth} style={{ ...box, maxWidth: 440 }}><h2>{mode === 'signin' ? 'Customer sign in' : 'Create customer account'}</h2><button type="button" onClick={googleSignIn} style={{ ...input, background: '#fff', fontWeight: 800, cursor: 'pointer' }}>Continue with Google</button><p style={{ textAlign: 'center', color: '#999', fontSize: 12 }}>or use email and password</p><label>Email address<input style={input} type="email" required value={email} onChange={e => setEmail(e.target.value)} /></label><label>Password<input style={input} type="password" minLength="8" required value={password} onChange={e => setPassword(e.target.value)} /></label><button style={{ ...input, background: '#ff7896', color: '#fff', border: 0, fontWeight: 800, cursor: 'pointer' }}>{mode === 'signin' ? 'Sign in' : 'Create account'}</button><button type="button" onClick={resetPassword} style={{ border: 0, background: 'transparent', marginTop: 12, color: '#e8798e', cursor: 'pointer' }}>Forgot password?</button><button type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage(''); }} style={{ border: 0, background: 'transparent', marginTop: 10, color: '#e8798e', cursor: 'pointer' }}>{mode === 'signin' ? 'New customer? Create account' : 'Already registered? Sign in'}</button>{message && <p role="status">{message}</p>}</form> : <>
      <div style={{ ...box, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}><div><b>{session.user.email}</b><div style={{ fontSize: 12, color: '#777' }}>Your private order history</div></div><button onClick={signout} style={{ padding: 10, borderRadius: 9, border: '1px solid #eee', background: '#fff' }}>Sign out</button></div>
      {message && <p role="status">{message}</p>}{busy && <p>Loading your orders…</p>}
      {!busy && !orders.length && <div style={box}><h2>No orders found yet</h2><p>Once you place an order while signed in, its tracking details will appear here.</p><a href="/">Browse toys →</a></div>}
      {orders.map(o => { const status = String(o.order_status || 'PLACED').toUpperCase(); const current = statuses.indexOf(status); return <article key={o.id} style={box}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><div><h2 style={{ margin: '0 0 5px' }}>Order #{o.id}</h2><small style={{ color: '#777' }}>Placed {new Date(o.created_at).toLocaleString('en-IN')}</small></div><strong>{money(o.total_amount)}</strong></div>
        <div style={{ display: 'inline-block', marginTop: 12, padding: '6px 10px', borderRadius: 20, background: '#fff0f4', color: '#bf5875', fontWeight: 800, fontSize: 12 }}>Status: {status.replaceAll('_', ' ')}</div>
        {status !== 'CANCELLED' && <div style={{ display: 'flex', gap: 7, margin: '18px 0', flexWrap: 'wrap' }}>{statuses.map((s, i) => <span key={s} style={{ fontSize: 11, padding: '7px 9px', borderRadius: 20, background: i <= current && current >= 0 ? '#d9f3e2' : '#f0edf1', color: i <= current && current >= 0 ? '#26714c' : '#777' }}>{i + 1}. {s.replaceAll('_', ' ')}</span>)}</div>}
        {status === 'CANCELLED' && <p style={{ color: '#b33' }}>This order was cancelled. Contact SOFTIES for help.</p>}
        <p><b>Delivery name:</b> {o.customer_name}</p><p><b>Contact:</b> {o.phone}</p><p><b>Delivery address:</b> {o.address}</p>
        {o.tracking_id && <p><b>Tracking / courier ID:</b> {o.tracking_id}</p>}{o.tracking_notes && <p><b>Store update:</b> {o.tracking_notes}</p>}
        <h3>Items</h3>{(items[o.id] || []).map(i => <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderTop: '1px solid #eee', gap: 12 }}><span>{i.product_name} × {i.quantity}</span><span>{money(i.unit_price * i.quantity)}</span></div>)}
        <p style={{ fontSize: 12, color: '#777' }}>Payment method: {o.payment_method} · Payment status: {o.payment_status}</p>
        {(updates[o.id] || []).length > 0 && <><h3>Tracking history</h3>{updates[o.id].map(t => <div key={t.id} style={{ borderTop: '1px solid #eee', padding: '9px 0' }}><b>{String(t.status).replaceAll('_', ' ')}</b><small style={{ display: 'block', color: '#888' }}>{new Date(t.created_at).toLocaleString('en-IN')}</small>{t.tracking_number && <div>Tracking: {t.tracking_number}</div>}{t.message && <div>{t.message}</div>}</div>)}</>}
      </article>; })}
    </>}
  </div></div>;
}
